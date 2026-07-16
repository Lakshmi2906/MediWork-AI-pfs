from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from database import db
from datetime import timedelta, datetime, timezone
from bson import ObjectId
import os, io
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='hwms_frontend', static_url_path='')
CORS(app, supports_credentials=False)

app.config['JWT_SECRET_KEY']           = os.getenv('JWT_SECRET_KEY', 'hwms-super-secret-key-2025')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=8)

bcrypt = Bcrypt(app)
jwt    = JWTManager(app)

# Collections
users_col        = db['users']
employees_col    = db['employees']
departments_col  = db['departments']
shifts_col       = db['shifts']
attendance_col   = db['attendance']
leave_col        = db['leave_requests']
trainings_col    = db['trainings']
notifications_col= db['notifications']

def serial(doc):
    """Convert MongoDB doc to JSON-safe dict."""
    doc['id'] = str(doc.pop('_id'))
    return doc

def auth_header():
    return {'Authorization': request.headers.get('Authorization', '')}

# ─────────────────────────────────────────
# STATIC ROUTES
# ─────────────────────────────────────────
@app.route('/')
def index():
    return render_template('login.html')

# ─────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    required = ['first_name', 'last_name', 'email', 'role', 'department', 'password']
    for field in required:
        if not data.get(field, '').strip():
            return jsonify({'message': f'{field.replace("_"," ").title()} is required.'}), 400

    email = data['email'].strip().lower()
    if users_col.find_one({'email': email}):
        return jsonify({'message': 'An account with this email already exists.'}), 409

    if data['role'] not in ['Admin', 'HR', 'Doctor', 'Nurse']:
        return jsonify({'message': 'Invalid role selected.'}), 400

    user_doc = {
        'first_name': data['first_name'].strip(),
        'last_name':  data['last_name'].strip(),
        'email':      email,
        'role':       data['role'],
        'department': data['department'],
        'password':   bcrypt.generate_password_hash(data['password']).decode('utf-8'),
        'is_active':  True,
        'created_at': datetime.now(timezone.utc),
    }
    result = users_col.insert_one(user_doc)
    return jsonify({'message': 'Account created successfully.', 'user_id': str(result.inserted_id)}), 201


@app.route('/api/login', methods=['POST'])
def login():
    data  = request.get_json()
    email = data.get('email', '').strip().lower()
    pw    = data.get('password', '')

    if not email or not pw:
        return jsonify({'message': 'Email and password are required.'}), 400

    user = users_col.find_one({'email': email})
    if not user:
        return jsonify({'message': 'No account found with this email.'}), 401
    if not bcrypt.check_password_hash(user['password'], pw):
        return jsonify({'message': 'Incorrect password. Please try again.'}), 401
    if not user.get('is_active', True):
        return jsonify({'message': 'Your account has been deactivated. Contact admin.'}), 403

    token = create_access_token(identity=email)
    return jsonify({
        'message': 'Login successful.',
        'token': token,
        'user': {
            'first_name': user['first_name'],
            'last_name':  user['last_name'],
            'email':      user['email'],
            'role':       user['role'],
            'department': user['department'],
        }
    }), 200


@app.route('/api/me', methods=['GET'])
@jwt_required()
def me():
    email = get_jwt_identity()
    user  = users_col.find_one({'email': email}, {'password': 0, '_id': 0})
    if not user:
        return jsonify({'message': 'User not found.'}), 404
    return jsonify(user), 200


@app.route('/api/dashboard/stats', methods=['GET'])
@jwt_required()
def dashboard_stats():
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    total_employees  = employees_col.count_documents({'status': 'Active'})
    present_today    = attendance_col.count_documents({'date': today, 'status': 'Present'})
    pending_leaves   = leave_col.count_documents({'status': 'Pending'})
    high_burnout     = employees_col.count_documents({'burnout_risk': 'High'})
    return jsonify({
        'total_employees': total_employees,
        'present_today':   present_today,
        'pending_leaves':  pending_leaves,
        'high_burnout':    high_burnout,
    })


@app.route('/api/dashboard/attendance-trend', methods=['GET'])
@jwt_required()
def attendance_trend():
    # Last 7 days
    from datetime import timedelta as td
    labels, present, absent = [], [], []
    for i in range(6, -1, -1):
        day = (datetime.now(timezone.utc) - td(days=i)).strftime('%Y-%m-%d')
        p   = attendance_col.count_documents({'date': day, 'status': 'Present'})
        a   = attendance_col.count_documents({'date': day, 'status': 'Absent'})
        labels.append((datetime.now(timezone.utc) - td(days=i)).strftime('%a'))
        present.append(p)
        absent.append(a)
    return jsonify({'labels': labels, 'present': present, 'absent': absent})


@app.route('/api/dashboard/department-split', methods=['GET'])
@jwt_required()
def department_split():
    pipeline = [{'$group': {'_id': '$department', 'count': {'$sum': 1}}}]
    result   = list(employees_col.aggregate(pipeline))
    return jsonify({
        'labels': [r['_id'] for r in result],
        'counts': [r['count'] for r in result],
    })

@app.route('/api/employees', methods=['GET'])
@jwt_required()
def get_employees():
    docs = [serial(e) for e in employees_col.find()]
    return jsonify(docs)


@app.route('/api/employees', methods=['POST'])
@jwt_required()
def add_employee():
    data = request.get_json()
    required = ['first_name', 'last_name', 'email', 'phone', 'department', 'designation', 'date_of_joining', 'status']
    for f in required:
        if not data.get(f, '').strip():
            return jsonify({'message': f'{f} is required.'}), 400
    if employees_col.find_one({'email': data['email'].strip().lower()}):
        return jsonify({'message': 'Employee with this email already exists.'}), 409
    data['email'] = data['email'].strip().lower()
    data['created_at'] = datetime.now(timezone.utc)
    result = employees_col.insert_one(data)
    return jsonify({'message': 'Employee added.', 'id': str(result.inserted_id)}), 201


@app.route('/api/employees/<emp_id>', methods=['PUT'])
@jwt_required()
def update_employee(emp_id):
    data = request.get_json()
    data.pop('id', None)
    employees_col.update_one({'_id': ObjectId(emp_id)}, {'$set': data})
    return jsonify({'message': 'Employee updated.'})


@app.route('/api/employees/<emp_id>', methods=['DELETE'])
@jwt_required()
def delete_employee(emp_id):
    employees_col.delete_one({'_id': ObjectId(emp_id)})
    return jsonify({'message': 'Employee deleted.'})

@app.route('/api/departments', methods=['GET'])
@jwt_required()
def get_departments():
    docs = [serial(d) for d in departments_col.find()]
    return jsonify(docs)


@app.route('/api/departments', methods=['POST'])
@jwt_required()
def add_department():
    data = request.get_json()
    if not data.get('name', '').strip():
        return jsonify({'message': 'Department name is required.'}), 400
    if departments_col.find_one({'name': data['name'].strip()}):
        return jsonify({'message': 'Department already exists.'}), 409
    data['created_at'] = datetime.now(timezone.utc)
    result = departments_col.insert_one(data)
    return jsonify({'message': 'Department added.', 'id': str(result.inserted_id)}), 201


@app.route('/api/departments/<dept_id>', methods=['DELETE'])
@jwt_required()
def delete_department(dept_id):
    departments_col.delete_one({'_id': ObjectId(dept_id)})
    return jsonify({'message': 'Department deleted.'})

@app.route('/api/shifts', methods=['GET'])
@jwt_required()
def get_shifts():
    docs = [serial(s) for s in shifts_col.find()]
    return jsonify(docs)


@app.route('/api/shifts', methods=['POST'])
@jwt_required()
def add_shift():
    data = request.get_json()
    if not data.get('name', '').strip():
        return jsonify({'message': 'Shift name is required.'}), 400
    data['created_at'] = datetime.now(timezone.utc)
    result = shifts_col.insert_one(data)
    return jsonify({'message': 'Shift added.', 'id': str(result.inserted_id)}), 201


@app.route('/api/shifts/<shift_id>', methods=['DELETE'])
@jwt_required()
def delete_shift(shift_id):
    shifts_col.delete_one({'_id': ObjectId(shift_id)})
    return jsonify({'message': 'Shift deleted.'})

@app.route('/api/attendance', methods=['GET'])
@jwt_required()
def get_attendance():
    date = request.args.get('date', '')
    dept = request.args.get('department', '')
    query = {}
    if date: query['date'] = date
    if dept: query['department'] = dept
    docs = [serial(a) for a in attendance_col.find(query)]
    return jsonify(docs)


@app.route('/api/attendance', methods=['POST'])
@jwt_required()
def add_attendance():
    data = request.get_json()
    data['created_at'] = datetime.now(timezone.utc)
    result = attendance_col.insert_one(data)
    return jsonify({'message': 'Attendance recorded.', 'id': str(result.inserted_id)}), 201

@app.route('/api/leave-requests', methods=['GET'])
@jwt_required()
def get_leave_requests():
    status = request.args.get('status', '')
    ltype  = request.args.get('type', '')
    query  = {}
    if status: query['status'] = status
    if ltype:  query['type']   = ltype
    docs = [serial(l) for l in leave_col.find(query)]
    return jsonify(docs)


@app.route('/api/leave-requests', methods=['POST'])
@jwt_required()
def add_leave_request():
    data = request.get_json()
    data['status']     = 'Pending'
    data['created_at'] = datetime.now(timezone.utc)
    result = leave_col.insert_one(data)
    return jsonify({'message': 'Leave request submitted.', 'id': str(result.inserted_id)}), 201


@app.route('/api/leave-requests/<leave_id>/<action>', methods=['PATCH'])
@jwt_required()
def handle_leave(leave_id, action):
    if action not in ('approve', 'reject'):
        return jsonify({'message': 'Invalid action.'}), 400
    status = 'Approved' if action == 'approve' else 'Rejected'
    leave_col.update_one({'_id': ObjectId(leave_id)}, {'$set': {'status': status}})
    return jsonify({'message': f'Leave {status.lower()}.'})

@app.route('/api/trainings', methods=['GET'])
@jwt_required()
def get_trainings():
    q      = request.args.get('q', '').lower()
    status = request.args.get('status', '')
    query  = {}
    if status: query['status'] = status
    docs = [serial(t) for t in trainings_col.find(query)]
    if q:
        docs = [t for t in docs if q in (t.get('employee','') + t.get('name','') + t.get('dept','')).lower()]
    return jsonify(docs)


@app.route('/api/trainings', methods=['POST'])
@jwt_required()
def add_training():
    data = request.get_json()
    data['created_at'] = datetime.now(timezone.utc)
    result = trainings_col.insert_one(data)
    return jsonify({'message': 'Training record added.', 'id': str(result.inserted_id)}), 201


# ─────────────────────────────────────────
# NOTIFICATIONS
# ─────────────────────────────────────────
@app.route('/api/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    docs = [serial(n) for n in notifications_col.find().sort('created_at', -1).limit(20)]
    return jsonify(docs)


@app.route('/api/notifications/mark-all-read', methods=['PATCH'])
@jwt_required()
def mark_all_read():
    notifications_col.update_many({'unread': True}, {'$set': {'unread': False}})
    return jsonify({'message': 'All notifications marked as read.'})


# ─────────────────────────────────────────
# REPORTS EXPORT
# ─────────────────────────────────────────
@app.route('/api/reports/<report_id>/export', methods=['GET'])
@jwt_required()
def export_report(report_id):
    fmt = request.args.get('format', 'pdf')

    data_map = {
        'employees':  (employees_col,   ['first_name','last_name','email','department','designation','status']),
        'attendance': (attendance_col,  ['name','dept','date','checkin','checkout','hours','status']),
        'leave':      (leave_col,       ['name','type','start','end','days','status']),
        'training':   (trainings_col,   ['employee','dept','name','completed','expiry','status']),
        'burnout':    (employees_col,   ['first_name','last_name','department','burnout_risk']),
    }

    if report_id not in data_map:
        return jsonify({'message': 'Unknown report.'}), 404

    col, fields = data_map[report_id]
    docs = list(col.find({}, {f: 1 for f in fields}))
    for d in docs:
        d.pop('_id', None)

    if fmt == 'excel':
        try:
            import openpyxl
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = report_id.title()
            ws.append(fields)
            for d in docs:
                ws.append([str(d.get(f, '')) for f in fields])
            buf = io.BytesIO()
            wb.save(buf)
            buf.seek(0)
            return send_file(buf, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                             as_attachment=True, download_name=f'{report_id}_report.xlsx')
        except ImportError:
            return jsonify({'message': 'openpyxl not installed. Run: pip install openpyxl'}), 500

    # PDF fallback — plain CSV if reportlab not installed
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
        from reportlab.lib import colors
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4)
        table_data = [fields] + [[str(d.get(f, '')) for f in fields] for d in docs]
        t = Table(table_data)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F6E56')),
            ('TEXTCOLOR',  (0,0), (-1,0), colors.white),
            ('FONTSIZE',   (0,0), (-1,-1), 8),
            ('GRID',       (0,0), (-1,-1), 0.5, colors.grey),
        ]))
        doc.build([t])
        buf.seek(0)
        return send_file(buf, mimetype='application/pdf',
                         as_attachment=True, download_name=f'{report_id}_report.pdf')
    except ImportError:
        # Fallback: return CSV
        import csv
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(docs)
        return send_file(io.BytesIO(buf.getvalue().encode()),
                         mimetype='text/csv', as_attachment=True,
                         download_name=f'{report_id}_report.csv')


if __name__ == '__main__':
    app.run(debug=True, port=5000)
