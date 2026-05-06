from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import mysql.connector
import os

app = Flask(__name__, static_folder='static')
CORS(app , resources={
        r"/*": {"origins": "*"}
    })

# ============================================================
# ⚙️        إعدادات قاعدة البيانات
# ============================================================

DB_CONFIG = {
    'host': '127.0.0.1',
    'user': 'root',
    'port': 3307 ,
    'password': '',
    'database': 'syria_network',
    'charset': 'utf8mb4'
}

def get_db_connection(database=True):
    config = {**DB_CONFIG}
    if not database:
        config.pop('database')
    return mysql.connector.connect(**config)

# ============================================================
# 🗄️  إنشاء الجداول تلقائياً
# ============================================================
def init_db():
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS persons (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            name        VARCHAR(200) NOT NULL,
            name_en     VARCHAR(200),
            nationality VARCHAR(100) DEFAULT 'سوري',
            residence   VARCHAR(200),
            family      VARCHAR(100),
            field       VARCHAR(200),
            notes       TEXT,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS companies (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            name        VARCHAR(300) NOT NULL,
            name_en     VARCHAR(300),
            type        VARCHAR(100) DEFAULT 'محدودة المسؤولية',
            sector      VARCHAR(200),
            city        VARCHAR(100),
            country     VARCHAR(100) DEFAULT 'سوريا',
            capital     VARCHAR(100),
            reg_number  VARCHAR(200),
            founded     VARCHAR(50),
            status      VARCHAR(50) DEFAULT 'نشطة',
            notes       TEXT,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS relations (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            person_id   INT NOT NULL,
            company_id  INT NOT NULL,
            role        VARCHAR(200) NOT NULL,
            shares      VARCHAR(100),
            percentage  DECIMAL(6,2),
            value_ls    BIGINT,
            notes       TEXT,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (person_id)  REFERENCES persons(id)  ON DELETE CASCADE,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            UNIQUE KEY unique_relation (person_id, company_id, role)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)

    conn.commit()
    cur.close()
    conn.close()
    print("✅ Database tables ready")

# ============================================================
# 👤  PERSONS API
# ============================================================
@app.route('/api/persons', methods=['GET'])
def get_persons():
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    search = request.args.get('search', '')
    if search:
        cur.execute("""
            SELECT p.*, COUNT(r.id) as relations_count
            FROM persons p LEFT JOIN relations r ON p.id = r.person_id
            WHERE p.name LIKE %s OR p.family LIKE %s OR p.nationality LIKE %s
            GROUP BY p.id ORDER BY relations_count DESC
        """, (f'%{search}%', f'%{search}%', f'%{search}%'))
    else:
        cur.execute("""
            SELECT p.*, COUNT(r.id) as relations_count
            FROM persons p LEFT JOIN relations r ON p.id = r.person_id
            GROUP BY p.id ORDER BY relations_count DESC
        """)
    rows = cur.fetchall()
    cur.close(); conn.close()
    return jsonify(rows)

@app.route('/api/persons/<int:pid>', methods=['GET'])
def get_person(pid):
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT * FROM persons WHERE id=%s", (pid,))
    person = cur.fetchone()
    if not person:
        cur.close(); conn.close()
        return jsonify({'error': 'not found'}), 404
    cur.execute("""
        SELECT r.*, c.name as company_name, c.sector, c.city
        FROM relations r JOIN companies c ON r.company_id = c.id
        WHERE r.person_id = %s ORDER BY r.role
    """, (pid,))
    person['relations'] = cur.fetchall()
    cur.close(); conn.close()
    return jsonify(person)

@app.route('/api/persons', methods=['POST'])
def add_person():
    d = request.json
    if not d.get('name'):
        return jsonify({'error': 'الاسم مطلوب'}), 400
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO persons (name, name_en, nationality, residence, family, field, notes)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
    """, (d.get('name'), d.get('name_en'), d.get('nationality','سوري'),
          d.get('residence'), d.get('family'), d.get('field'), d.get('notes')))
    conn.commit()
    new_id = cur.lastrowid
    cur.close(); conn.close()
    return jsonify({'success': True, 'id': new_id})

@app.route('/api/persons/<int:pid>', methods=['PUT'])
def update_person(pid):
    d = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE persons SET name=%s, name_en=%s, nationality=%s, residence=%s,
        family=%s, field=%s, notes=%s WHERE id=%s
    """, (d.get('name'), d.get('name_en'), d.get('nationality'),
          d.get('residence'), d.get('family'), d.get('field'), d.get('notes'), pid))
    conn.commit()
    cur.close(); conn.close()
    return jsonify({'success': True})

@app.route('/api/persons/<int:pid>', methods=['DELETE'])
def delete_person(pid):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM persons WHERE id=%s", (pid,))
    conn.commit()
    cur.close(); conn.close()
    return jsonify({'success': True})

# ============================================================
# 🏢  COMPANIES API
# ============================================================
@app.route('/api/companies', methods=['GET'])
def get_companies():
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    search = request.args.get('search', '')
    if search:
        cur.execute("""
            SELECT c.*, COUNT(r.id) as relations_count
            FROM companies c LEFT JOIN relations r ON c.id = r.company_id
            WHERE c.name LIKE %s OR c.sector LIKE %s OR c.city LIKE %s
            GROUP BY c.id ORDER BY relations_count DESC
        """, (f'%{search}%', f'%{search}%', f'%{search}%'))
    else:
        cur.execute("""
            SELECT c.*, COUNT(r.id) as relations_count
            FROM companies c LEFT JOIN relations r ON c.id = r.company_id
            GROUP BY c.id ORDER BY relations_count DESC
        """)
    rows = cur.fetchall()
    cur.close(); conn.close()
    return jsonify(rows)

@app.route('/api/companies/<int:cid>', methods=['GET'])
def get_company(cid):
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT * FROM companies WHERE id=%s", (cid,))
    company = cur.fetchone()
    if not company:
        cur.close(); conn.close()
        return jsonify({'error': 'not found'}), 404
    cur.execute("""
        SELECT r.*, p.name as person_name, p.nationality, p.family
        FROM relations r JOIN persons p ON r.person_id = p.id
        WHERE r.company_id = %s ORDER BY r.percentage DESC
    """, (cid,))
    company['relations'] = cur.fetchall()
    cur.close(); conn.close()
    return jsonify(company)

@app.route('/api/companies', methods=['POST'])
def add_company():
    d = request.json
    if not d.get('name'):
        return jsonify({'error': 'اسم الشركة مطلوب'}), 400
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO companies (name, name_en, type, sector, city, country, capital, reg_number, founded, status, notes)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (d.get('name'), d.get('name_en'), d.get('type','محدودة المسؤولية'),
          d.get('sector'), d.get('city'), d.get('country','سوريا'),
          d.get('capital'), d.get('reg_number'), d.get('founded'),
          d.get('status','نشطة'), d.get('notes')))
    conn.commit()
    new_id = cur.lastrowid
    cur.close(); conn.close()
    return jsonify({'success': True, 'id': new_id})

@app.route('/api/companies/<int:cid>', methods=['PUT'])
def update_company(cid):
    d = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE companies SET name=%s, name_en=%s, type=%s, sector=%s, city=%s,
        country=%s, capital=%s, reg_number=%s, founded=%s, status=%s, notes=%s
        WHERE id=%s
    """, (d.get('name'), d.get('name_en'), d.get('type'), d.get('sector'),
          d.get('city'), d.get('country'), d.get('capital'), d.get('reg_number'),
          d.get('founded'), d.get('status'), d.get('notes'), cid))
    conn.commit()
    cur.close(); conn.close()
    return jsonify({'success': True})

@app.route('/api/companies/<int:cid>', methods=['DELETE'])
def delete_company(cid):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM companies WHERE id=%s", (cid,))
    conn.commit()
    cur.close(); conn.close()
    return jsonify({'success': True})

# ============================================================
# 🔗  RELATIONS API
# ============================================================
@app.route('/api/relations', methods=['GET'])
def get_relations():
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("""
        SELECT r.*, p.name as person_name, p.nationality,
               c.name as company_name, c.sector, c.city
        FROM relations r
        JOIN persons p ON r.person_id = p.id
        JOIN companies c ON r.company_id = c.id
        ORDER BY r.created_at DESC
    """)
    rows = cur.fetchall()
    cur.close(); conn.close()
    return jsonify(rows)

@app.route('/api/relations', methods=['POST'])
def add_relation():
    d = request.json
    if not d.get('person_id') or not d.get('company_id') or not d.get('role'):
        return jsonify({'error': 'الشخص والشركة والدور مطلوبة'}), 400
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO relations (person_id, company_id, role, shares, percentage, value_ls, notes)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
        """, (d['person_id'], d['company_id'], d['role'],
              d.get('shares'), d.get('percentage'), d.get('value_ls'), d.get('notes')))
        conn.commit()
        new_id = cur.lastrowid
        cur.close(); conn.close()
        return jsonify({'success': True, 'id': new_id})
    except mysql.connector.IntegrityError:
        cur.close(); conn.close()
        return jsonify({'error': 'هذه العلاقة موجودة مسبقاً'}), 409

@app.route('/api/relations/<int:rid>', methods=['PUT'])
def update_relation(rid):
    d = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE relations SET role=%s, shares=%s, percentage=%s, value_ls=%s, notes=%s
        WHERE id=%s
    """, (d.get('role'), d.get('shares'), d.get('percentage'), d.get('value_ls'), d.get('notes'), rid))
    conn.commit()
    cur.close(); conn.close()
    return jsonify({'success': True})

@app.route('/api/relations/<int:rid>', methods=['DELETE'])
def delete_relation(rid):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM relations WHERE id=%s", (rid,))
    conn.commit()
    cur.close(); conn.close()
    return jsonify({'success': True})

# ============================================================
# 🕸️  NETWORK API (للخريطة)
# ============================================================
@app.route('/api/network', methods=['GET'])
def get_network():
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    cur.execute("""
        SELECT p.id, p.name as label, 'person' as type,
               p.nationality as nat, p.family,
               COUNT(r.id) as connections
        FROM persons p LEFT JOIN relations r ON p.id = r.person_id
        GROUP BY p.id HAVING connections > 0
    """)
    persons = cur.fetchall()

    cur.execute("""
        SELECT c.id, c.name as label, 'company' as type,
               c.sector, c.city, c.capital,
               COUNT(r.id) as connections
        FROM companies c LEFT JOIN relations r ON c.id = r.company_id
        GROUP BY c.id HAVING connections > 0
    """)
    companies = cur.fetchall()

    cur.execute("""
        SELECT r.person_id as source, r.company_id as target,
               r.role, r.percentage, r.shares
        FROM relations r
    """)
    links = cur.fetchall()

    cur.close(); conn.close()

    nodes = []
    for p in persons:
        nodes.append({**p, 'id': f"P{p['id']}", 'db_id': p['id']})
    for c in companies:
        nodes.append({**c, 'id': f"C{c['id']}", 'db_id': c['id']})

    edges = []
    for l in links:
        edges.append({
            'source': f"P{l['source']}",
            'target': f"C{l['target']}",
            'role':   l['role'],
            'percentage': str(l['percentage']) if l['percentage'] else '',
            'shares': l['shares'] or ''
        })

    return jsonify({'nodes': nodes, 'links': edges})

# ============================================================
# 📊  STATS API
# ============================================================
@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT COUNT(*) as total FROM persons")
    p = cur.fetchone()['total']
    cur.execute("SELECT COUNT(*) as total FROM companies")
    c = cur.fetchone()['total']
    cur.execute("SELECT COUNT(*) as total FROM relations")
    r = cur.fetchone()['total']
    cur.execute("""
        SELECT p.name, COUNT(r.id) as cnt FROM persons p
        JOIN relations r ON p.id=r.person_id
        GROUP BY p.id ORDER BY cnt DESC LIMIT 5
    """)
    top_persons = cur.fetchall()
    cur.execute("""
        SELECT c.name, COUNT(r.id) as cnt FROM companies c
        JOIN relations r ON c.id=r.company_id
        GROUP BY c.id ORDER BY cnt DESC LIMIT 5
    """)
    top_companies = cur.fetchall()
    cur.close(); conn.close()
    return jsonify({
        'persons': p, 'companies': c, 'relations': r,
        'top_persons': top_persons, 'top_companies': top_companies
    })

# ============================================================
# 🌐  Serve Frontend
# ============================================================
@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('static', path)

if __name__ == '__main__':
    init_db()
    print("🚀 Server running at http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
