
"""SPORTUNI WELCOME 2026 · Vercel Flask + Supabase PostgREST.
Only this server sees service-role credentials. Never send them to a browser.
"""

import csv, hashlib, hmac, io, os, re, secrets, time, uuid
from urllib.parse import quote
import requests
from flask import Flask, Response, abort, jsonify, make_response, redirect, request, send_from_directory
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

app = Flask(__name__, static_folder='static', static_url_path='/static')
BASE = os.environ.get('SUPABASE_URL', '').rstrip('/')
KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
ANON = os.environ.get('SUPABASE_ANON_KEY', '')
SESSION_KEY = os.environ.get('FLASK_SECRET_KEY', '')
DEVICE_KEY = os.environ.get('DEVICE_HASH_SECRET', '')
PUBLIC = os.environ.get('PUBLIC_BASE_URL', '').rstrip('/')
SESSION_TTL = 60*60*8

class ApiError(Exception):
    def __init__(self, message, code=400):
        super().__init__(message)
        self.code = code

@app.errorhandler(ApiError)
def handle(e):
    return jsonify(detail=str(e)), e.code

@app.errorhandler(404)
def not_found(e):
    return jsonify(detail='გვერდი ვერ მოიძებნა'), 404

def configured():
    if not (BASE.startswith('https://') and KEY and ANON and len(SESSION_KEY)>=32 and len(DEVICE_KEY)>=32):
        raise ApiError('საიტის სერვერი ჯერ არ არის დაკონფიგურირებული.', 503)

def db(table, method='GET', params=None, body=None, prefer=None):
    configured()
    h={'apikey':KEY, 'Accept':'application/json'}
    if not KEY.startswith('sb_secret_'):
        h['Authorization']='Bearer '+KEY
    if body is not None:
        h['Content-Type']='application/json'
    if prefer:
        h['Prefer']=prefer
    try:
        r=requests.request(
            method,
            BASE+'/rest/v1/'+table,
            params=params,
            json=body,
            headers=h,
            timeout=12
        )
    except requests.RequestException:
        raise ApiError('მონაცემთა ბაზასთან კავშირი ვერ დამყარდა',503)
    if r.status_code>=400:
        if r.status_code==409:
            raise ApiError('ჩანაწერი უკვე არსებობს ან შეცვლილია',409)
        app.logger.warning(
            'Database request failed: %s %s',
            r.status_code,
            r.text[:160]
        )
        raise ApiError('მონაცემთა ბაზის ოპერაცია ვერ შესრულდა',503)
    if not r.content:
        return None
    try:
        return r.json()
    except ValueError:
        return None

def one(table, **filters):
    rows=db(
        table,
        params={
            **{k:'eq.'+str(v) for k,v in filters.items()},
            'limit':'1'
        }
    )
    return (rows or [None])[0]

def setting():
    return one('event_settings',id=1)

def question(qid):
    return one('questions',id=qid) if qid else None

def current():
    s=setting()
    return s,question(s.get('active_question_id')) if s else None

def signed():
    if len(SESSION_KEY)<32:
        raise ApiError('სერვერის საიდუმლო გასაღები არ არის დაყენებული',503)
    return URLSafeTimedSerializer(
        SESSION_KEY,
        salt='sportuni-staff-session-v1'
    )

def staff(required='moderator'):
    token=request.cookies.get('su_staff')
    if not token:
        raise ApiError('გაიარე ავტორიზაცია',401)
    try:
        person=signed().loads(token,max_age=SESSION_TTL)
    except (BadSignature,SignatureExpired):
        raise ApiError('სესია დასრულებულია. შედი ხელახლა.',401)
    role=one('staff_roles',user_id=person.get('uid',''))
    if not role or not role.get('is_active'):
        raise ApiError('წვდომა შეზღუდულია',403)
    if required=='admin' and role['role']!='admin':
        raise ApiError('მხოლოდ მთავარ ადმინისტრატორს შეუძლია',403)
    return person['uid'],role['role']

def json_input():
    if not request.is_json:
        raise ApiError('მოთხოვნის ფორმატი არასწორია')
    return request.get_json(silent=True) or {}

def device():
    d=request.cookies.get('su_device')
    try:
        uuid.UUID(d)
        return d
    except (ValueError,TypeError,AttributeError):
        return str(uuid.uuid4())

def d_hash(d):
    configured()
    return hmac.new(
        DEVICE_KEY.encode(),
        d.encode(),
        hashlib.sha256
    ).hexdigest()

def setdevice(resp,d):
    resp.set_cookie(
        'su_device',
        d,
        max_age=60*60*24*365,
        httponly=True,
        secure=request.is_secure,
        samesite='Lax',
        path='/'
    )
    return resp

@app.before_request
def origin_guard():
    if request.method in ('POST','PUT','PATCH','DELETE'):
        origin=request.headers.get('Origin')
        if origin:
            from urllib.parse import urlparse
            u=urlparse(origin)
            expected_host=request.host.lower()
            if not (
                (u.scheme=='https' or
                 (u.scheme=='http' and request.host.startswith('localhost')))
                and u.netloc.lower()==expected_host
            ):
                raise ApiError('მოთხოვნა დაბლოკილია',403)

@app.after_request
def response_headers(resp):
    if request.path.startswith('/api/') or request.path in (
        '/admin','/moderator','/login','/join','/confirmation'
    ):
        resp.headers['Cache-Control']='no-store'
    resp.headers['X-Content-Type-Options']='nosniff'
    resp.headers['Referrer-Policy']='strict-origin-when-cross-origin'
    resp.headers['X-Frame-Options']='SAMEORIGIN'
    resp.headers['Content-Security-Policy']="frame-ancestors 'self'"
    return resp

@app.route('/health')
def health():
    return jsonify(
        ok=True,
        configured=bool(BASE and KEY and ANON and SESSION_KEY and DEVICE_KEY)
    )

@app.route('/')
def homepage():
    return redirect('/screen')

# ============================================================
# PAGE ROUTER — INCLUDES LIVE POLL
# ============================================================

@app.route('/<path:name>')
def page(name):
    paths={
        'screen':'screen.html',
        'qr-view':'qr.html',
        'wall-view':'wall.html',
        'poll-view':'poll.html',
        'join':'join.html',
        'confirmation':'confirmation.html',
        'login':'login.html',
        'admin':'admin.html',
        'moderator':'moderator.html'
    }
    if name not in paths:
        abort(404)
    if name=='admin':
        staff('admin')
    if name=='moderator':
        staff('moderator')
    resp=make_response(send_from_directory('static',paths[name]))
    if name in ('join','confirmation'):
        setdevice(resp,device())
    return resp

# ============================================================
# AUTHENTICATION
# ============================================================

@app.route('/api/login',methods=['POST'])
def login():
    configured()
    info=json_input()
    email=info.get('email','').strip()
    pwd=info.get('password','')
    if not isinstance(email,str) or not isinstance(pwd,str) or len(email)>254 or not pwd:
        raise ApiError('შეიყვანე ელფოსტა და პაროლი')
    try:
        r=requests.post(
            BASE+'/auth/v1/token',
            params={'grant_type':'password'},
            headers={'apikey':ANON,'Content-Type':'application/json'},
            json={'email':email,'password':pwd},
            timeout=12
        )
    except requests.RequestException:
        raise ApiError('ავტორიზაციის სერვერთან კავშირი ვერ დამყარდა',503)
    if not r.ok:
        raise ApiError('ელფოსტა ან პაროლი არასწორია',401)
    uid=r.json()['user']['id']
    role=one('staff_roles',user_id=uid)
    if not role or not role.get('is_active'):
        raise ApiError('ამ ანგარიშს მოდერაციის უფლება არ აქვს',403)
    resp=jsonify(
        redirect='/admin' if role['role']=='admin' else '/moderator'
    )
    resp.set_cookie(
        'su_staff',
        signed().dumps({'uid':uid}),
        max_age=SESSION_TTL,
        httponly=True,
        secure=request.is_secure,
        samesite='Lax',
        path='/'
    )
    return resp

@app.route('/api/logout',methods=['POST'])
def logout():
    resp=jsonify(ok=True)
    resp.delete_cookie('su_staff')
    return resp

# ============================================================
# PUBLIC STATUS — INCLUDES QUESTION TYPE
# ============================================================

@app.route('/api/public')
def public():
    s,q=current()
    if not s:
        raise ApiError('ღონისძიების პარამეტრები ვერ მოიძებნა',503)
    return jsonify(
        question={
            'id':q['id'],
            'text':q['text']
        } if q else {
            'id':None,
            'text':'კითხვა ჯერ არ გამოქვეყნებულა'
        },
        question_type=(
            q.get('question_type','text')
            if q else None
        ),
        screen=s['screen_mode'],
        intake=s['intake_enabled'] and bool(q),
        animation=s['animation_enabled'],
        speed=float(s['animation_speed']),
        answer_duration_seconds=int(
            s.get('answer_duration_seconds') or 8
        )
    )

# ============================================================
# ORIGINAL STUDENT TEXT QUESTIONS
# ============================================================

@app.route('/api/student/status')
def student_status():
    s,q=current()
    d=device()
    ans=one(
        'answers',
        question_id=q['id'],
        device_hash=d_hash(d)
    ) if q else None
    resp=jsonify(
        question={
            'id':q['id'],
            'text':q['text']
        } if q else {
            'id':None,
            'text':'კითხვა ჯერ არ გამოქვეყნებულა'
        },
        intake=bool(s['intake_enabled'] and q),
        answered=bool(ans),
        answer=ans['answer_text'] if ans else None,
        review=bool(ans and ans['status']=='pending')
    )
    return setdevice(resp,d)

@app.route('/api/student/submit',methods=['POST'])
def student_submit():
    body=json_input()
    text=body.get('text','')
    qid=body.get('qid')
    sid=body.get('submission_id')

    if not isinstance(text,str) or not (1<=len(text.strip())<=100):
        raise ApiError('პასუხი უნდა შეიცავდეს 1–100 სიმბოლოს')
    text=text.strip()

    try:
        uuid.UUID(str(qid))
        uuid.UUID(str(sid))
    except (ValueError,TypeError,AttributeError):
        raise ApiError('კითხვა ან გაგზავნის მოთხოვნა არასწორია')

    d=device()
    s,q=current()

    if q and q.get('question_type')=='poll':
        raise ApiError('ამ კითხვაზე პასუხი უნდა აირჩიო',409)

    if s and s.get('student_session_closed',False):
        raise ApiError('ღონისძიება დასრულებულია',409)

    if not q or qid!=q['id'] or not s['intake_enabled']:
        raise ApiError('კითხვა შეიცვალა ან პასუხების მიღება შეჩერებულია',409)

    status='pending'
    source='awaiting_review'
    reason=None

    if s['moderation_mode']=='direct':
        status,source='approved','automatic'

    if s['moderation_mode']=='ai':
        token=os.environ.get('OPENAI_API_KEY','')
        if token:
            try:
                r=requests.post(
                    'https://api.openai.com/v1/moderations',
                    headers={'Authorization':'Bearer '+token},
                    json={
                        'model':'omni-moderation-latest',
                        'input':text
                    },
                    timeout=8
                )
                r.raise_for_status()
                result=r.json()['results'][0]
                scores=result.get('category_scores',{})
                severe=(
                    'sexual/minors',
                    'hate/threatening',
                    'harassment/threatening',
                    'violence/graphic'
                )
                if any(float(scores.get(k,0))>=0.90 for k in severe):
                    status,source,reason=(
                        'blocked',
                        'automatic',
                        'high-confidence severe category'
                    )
                elif result.get('flagged'):
                    status,source,reason='pending','automatic','AI flagged'
                else:
                    status,source='approved','automatic'
            except (
                requests.RequestException,
                KeyError,
                IndexError,
                ValueError
            ):
                status,source,reason='pending','fallback','AI unavailable'
        else:
            status,source,reason='pending','fallback','AI not configured'

    rows=db(
        'rpc/submit_sportuni_answer',
        method='POST',
        body={
            'p_question':qid,
            'p_text':text,
            'p_hash':d_hash(d),
            'p_submission':sid,
            'p_status':status,
            'p_source':source,
            'p_reason':reason
        }
    )

    resp=jsonify(
        ok=True,
        answer_id=rows['id'],
        status=rows['status']
    )
    return setdevice(resp,d)

# ============================================================
# ORIGINAL LIVE WALL
# ============================================================

@app.route('/api/screen/answers')
def screen_answers():
    s,q=current()
    arr=db(
        'answers',
        params={
            'question_id':'eq.'+q['id'],
            'status':'eq.approved',
            'select':'id,answer_text,created_at',
            'order':'created_at.asc',
            'limit':'500'
        }
    ) if q else []
    return jsonify(
        answers=[
            {'id':a['id'],'text':a['answer_text']}
            for a in (arr or [])
        ]
    )

@app.route('/api/qr.svg')
def qr_svg():
    import qrcode
    from qrcode.image.svg import SvgPathImage
    origin=PUBLIC or request.url_root.rstrip('/')
    qr=qrcode.make(
        origin+'/join',
        image_factory=SvgPathImage,
        box_size=8,
        border=3
    )
    out=io.BytesIO()
    qr.save(out)
    return Response(
        out.getvalue(),
        mimetype='image/svg+xml',
        headers={'Cache-Control':'no-store'}
    )

# ============================================================
# DASHBOARD
# ============================================================

def shape_question(q):
    return {
        'id':q['question_number'],
        'uuid':q['id'],
        'text':q['text'],
        'date':q['created_at']
    }

def shape_answer(a,nums):
    return {
        'id':a['id'],
        'text':a['answer_text'],
        'status':a['status'],
        'qid':nums.get(a['question_id'],'?'),
        'created_at':a['created_at']
    }

@app.route('/api/dashboard')
def dashboard():
    uid,role=staff()
    s,q=current()
    questions=db(
        'questions',
        params={
            'select':'id,question_number,text,created_at',
            'order':'question_number.desc',
            'limit':'250'
        }
    ) or []
    nums={
        p['id']:p['question_number']
        for p in questions
    }
    if role=='admin':
        answers=db(
            'answers',
            params={
                'select':'id,question_id,answer_text,status,created_at',
                'order':'created_at.desc',
                'limit':'1500'
            }
        ) or []
    else:
        answers=db(
            'answers',
            params={
                'select':'id,question_id,answer_text,status,created_at',
                'status':'eq.pending',
                'order':'created_at.desc',
                'limit':'400'
            }
        ) or []

    return jsonify(
        role=role,
        qid=q['question_number'] if q else 0,
        screen=s['screen_mode'],
        intake=s['intake_enabled'],
        animation=s['animation_enabled'],
        speed=float(s['animation_speed']),
        answer_duration_seconds=int(
            s.get('answer_duration_seconds') or 8
        ),
        moderation_mode=s['moderation_mode'],
        questions=[
            shape_question(x)
            for x in questions
        ],
        answers=[
            shape_answer(x,nums)
            for x in answers
        ]
    )

@app.route('/api/admin/change',methods=['POST'])
def admin_change():
    staff('admin')
    j=json_input()
    k=j.get('key')
    v=j.get('value')
    cols={
        'screen':'screen_mode',
        'intake':'intake_enabled',
        'animation':'animation_enabled',
        'speed':'animation_speed',
        'answer_duration_seconds':'answer_duration_seconds',
        'moderation_mode':'moderation_mode'
    }
    if k not in cols:
        raise ApiError('პარამეტრი არ არსებობს')
    if k=='screen' and v not in ('qr','wall'):
        raise ApiError('რეჟიმი არასწორია')
    if k=='moderation_mode' and v not in ('ai','manual','direct'):
        raise ApiError('მოდერაციის რეჟიმი არასწორია')
    if k in ('intake','animation') and not isinstance(v,bool):
        raise ApiError('მნიშვნელობა არასწორია')
    if k=='speed' and (
        not isinstance(v,(float,int))
        or isinstance(v,bool)
        or not .5<=v<=2
    ):
        raise ApiError('სიჩქარე არასწორია')
    if k=='answer_duration_seconds' and (
        type(v) is not int or not 3<=v<=60
    ):
        raise ApiError('აირჩიე 3-დან 60 წამამდე')

    db(
        'event_settings',
        method='PATCH',
        params={'id':'eq.1'},
        body={cols[k]:v}
    )
    return jsonify(ok=True)

@app.route('/api/admin/question',methods=['POST'])
def publish():
    uid,_=staff('admin')
    val=json_input().get('text','')
    if not isinstance(val,str) or not 1<=len(val.strip())<=200:
        raise ApiError('კითხვა უნდა შეიცავდეს 1–200 სიმბოლოს')
    return jsonify(
        db(
            'rpc/publish_sportuni_question',
            method='POST',
            body={
                'p_text':val.strip(),
                'p_admin':uid
            }
        )
    )

# ============================================================
# MODERATION
# ============================================================

@app.route('/api/review/<aid>',methods=['POST'])
def review(aid):
    uid,_=staff()
    status=json_input().get('status')
    if status not in ('approved','blocked'):
        raise ApiError('გადაწყვეტილება არასწორია')
    try:
        uuid.UUID(aid)
    except ValueError:
        raise ApiError('პასუხის ID არასწორია')
    result=db(
        'rpc/review_sportuni_answer',
        method='POST',
        body={
            'p_answer':aid,
            'p_status':status,
            'p_reviewer':uid
        }
    )
    if not result:
        raise ApiError('ეს პასუხი უკვე დამუშავებულია',409)
    return jsonify(ok=True)

# ============================================================
# CSV EXPORT
# ============================================================

@app.route('/api/admin/export.csv')
def export():
    staff('admin')
    questions=db(
        'questions',
        params={
            'select':'id,question_number,text',
            'limit':'500'
        }
    ) or []
    qs={r['id']:r for r in questions}
    answers=db(
        'answers',
        params={
            'select':'question_id,answer_text,status,created_at',
            'order':'created_at.asc',
            'limit':'10000'
        }
    ) or []

    stream=io.StringIO()
    stream.write('\ufeff')
    w=csv.writer(stream)
    w.writerow(['კითხვა №','კითხვა','პასუხი','სტატუსი','დრო'])
    for a in answers:
        q=qs.get(a['question_id'],{})
        txt=a['answer_text']
        if txt and txt[0] in '=+-@\t\r':
            txt="'"+txt
        w.writerow([
            q.get('question_number',''),
            q.get('text',''),
            txt,
            a['status'],
            a['created_at']
        ])
    return Response(
        stream.getvalue(),
        mimetype='text/csv; charset=utf-8',
        headers={
            'Content-Disposition':
            'attachment; filename=SPORTUNI_WELCOME_responses.csv'
        }
    )

@app.route('/api/admin/questions/<qid>/export.csv')
def export_question(qid):
    staff('admin')
    try:
        uuid.UUID(qid)
    except (ValueError, AttributeError):
        raise ApiError('კითხვის ID არასწორია')

    q=one('questions',id=qid)
    if not q:
        raise ApiError('კითხვა ვერ მოიძებნა',404)

    rows=db(
        'answers',
        params={
            'question_id':'eq.'+qid,
            'select':'answer_text,status,created_at',
            'order':'created_at.asc',
            'limit':'10000'
        }
    ) or []

    stream=io.StringIO()
    stream.write('\ufeff')
    writer=csv.writer(stream)
    writer.writerow([
        'კითხვა №','კითხვა','პასუხი','სტატუსი','დრო'
    ])

    for answer in rows:
        value=answer['answer_text']
        if value and value.lstrip()[:1] in ('=','+','-','@'):
            value="'"+value
        writer.writerow([
            q['question_number'],
            q['text'],
            value,
            answer['status'],
            answer['created_at']
        ])

    filename=f"SPORTUNI_question_{q['question_number']}_answers.csv"

    return Response(
        stream.getvalue(),
        mimetype='text/csv; charset=utf-8',
        headers={
            'Content-Disposition':
                f'attachment; filename="{filename}"'
        }
    )

# ============================================================
# DELETE QUESTIONS
# ============================================================

@app.route('/api/admin/questions/delete',methods=['POST'])
def delete_questions():
    staff('admin')
    payload=json_input()
    ids=payload.get('question_ids')

    if not isinstance(ids,list) or not ids or len(ids)>100:
        raise ApiError('აირჩიე 1-დან 100-მდე კითხვა')

    normalized=[]

    for value in ids:
        if not isinstance(value,str):
            raise ApiError('კითხვის ID არასწორია')
        try:
            normalized.append(str(uuid.UUID(value)))
        except ValueError:
            raise ApiError('კითხვის ID არასწორია')

    normalized=list(dict.fromkeys(normalized))

    s,_=current()
    if s and s.get('active_question_id') in normalized:
        raise ApiError('აქტიური კითხვის წაშლა შეუძლებელია',409)

    result=db(
        'rpc/delete_sportuni_questions',
        method='POST',
        body={'p_question_ids':normalized}
    )

    return jsonify(result or {'ok':True})

@app.route('/api/admin/clear-answers',methods=['POST'])
def clear_answers():
    staff('admin')
    raise ApiError(
        'რეალურ ვერსიაში მონაცემების სამუდამო წაშლა გამორთულია. გამოიყენე CSV ექსპორტი.',
        403
    )

# ============================================================
# TEAM MANAGEMENT
# ============================================================

@app.route('/api/admin/team',methods=['GET'])
def team():
    staff('admin')
    return jsonify(
        members=db(
            'staff_roles',
            params={
                'select':'user_id,role,is_active,created_at',
                'order':'created_at.asc'
            }
        ) or []
    )

@app.route('/api/admin/team/revoke',methods=['POST'])
def revoke():
    uid,_=staff('admin')
    user=json_input().get('user_id','')
    if user==uid:
        raise ApiError('საკუთარი ადმინ-წვდომის გაუქმება აქ შეუძლებელია')
    record=one('staff_roles',user_id=user)
    if not record or record['role']!='moderator':
        raise ApiError('მოდერატორი ვერ მოიძებნა')
    db(
        'staff_roles',
        method='PATCH',
        params={'user_id':'eq.'+user},
        body={'is_active':False}
    )
    return jsonify(ok=True)

@app.route('/api/admin/team/grant',methods=['POST'])
def grant():
    staff('admin')
    uid=str(json_input().get('user_id','')).strip()
    try:
        uuid.UUID(uid)
    except ValueError:
        raise ApiError('შეიყვანე Supabase Auth User ID')

    db(
        'staff_roles',
        method='POST',
        body={
            'user_id':uid,
            'role':'moderator',
            'is_active':True
        },
        prefer='resolution=merge-duplicates,return=minimal'
    )
    return jsonify(ok=True)

# ============================================================
# PREPARED QUESTIONS
# ============================================================

from datetime import datetime, timezone

def prepared_id(value):
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError,TypeError,AttributeError):
        raise ApiError('მომზადებული კითხვის ID არასწორია')

def prepared_text(value):
    if not isinstance(value,str) or not 1<=len(value.strip())<=200:
        raise ApiError('კითხვა უნდა შეიცავდეს 1–200 სიმბოლოს')
    return value.strip()

def prepared_get(qid):
    result=one('prepared_questions',id=qid)
    if not result:
        raise ApiError('მომზადებული კითხვა ვერ მოიძებნა',404)
    return result

def prepared_list():
    return db(
        'prepared_questions',
        params={
            'select':(
                'id,question_text,sort_order,'
                'last_published_at,created_at,updated_at'
            ),
            'order':'sort_order.asc,created_at.asc',
            'limit':'500'
        }
    ) or []

@app.route('/api/admin/prepared-questions',methods=['GET','POST'])
def prepared_questions():
    staff('admin')

    if request.method=='GET':
        return jsonify(questions=prepared_list())

    text=prepared_text(json_input().get('text'))
    existing=prepared_list()

    if len(existing)>=500:
        raise ApiError('მაქსიმუმ 500 მომზადებული კითხვა')

    next_order=max(
        (int(x['sort_order']) for x in existing),
        default=0
    )+1

    created=db(
        'prepared_questions',
        method='POST',
        body={
            'question_text':text,
            'sort_order':next_order
        },
        prefer='return=representation'
    )

    return jsonify(ok=True,question=created[0]),201

@app.route('/api/admin/prepared-questions/reorder',methods=['POST'])
def prepared_reorder():
    staff('admin')
    ids=json_input().get('question_ids')

    if not isinstance(ids,list) or len(ids)>500:
        raise ApiError('კითხვების სია არასწორია')

    normalized=[prepared_id(x) for x in ids]

    if len(normalized)!=len(set(normalized)):
        raise ApiError('სიაში განმეორებული კითხვებია')

    existing=prepared_list()

    if set(normalized)!={x['id'] for x in existing}:
        raise ApiError(
            'კითხვების სია შეიცვალა. განაახლე გვერდი.',
            409
        )

    for position,qid in enumerate(normalized,start=1):
        db(
            'prepared_questions',
            method='PATCH',
            params={'id':'eq.'+qid},
            body={
                'sort_order':position,
                'updated_at':datetime.now(timezone.utc).isoformat()
            }
        )
    return jsonify(ok=True)

@app.route('/api/admin/prepared-questions/<qid>',methods=['PATCH','DELETE'])
def prepared_item(qid):
    staff('admin')
    qid=prepared_id(qid)
    prepared_get(qid)

    if request.method=='DELETE':
        db(
            'prepared_questions',
            method='DELETE',
            params={'id':'eq.'+qid}
        )
        return jsonify(ok=True)

    text=prepared_text(json_input().get('text'))

    db(
        'prepared_questions',
        method='PATCH',
        params={'id':'eq.'+qid},
        body={
            'question_text':text,
            'updated_at':datetime.now(timezone.utc).isoformat()
        }
    )
    return jsonify(ok=True)

@app.route('/api/admin/prepared-questions/<qid>/publish',methods=['POST'])
def prepared_publish(qid):
    uid,_=staff('admin')
    qid=prepared_id(qid)
    record=prepared_get(qid)

    published=db(
        'rpc/publish_sportuni_question',
        method='POST',
        body={
            'p_text':record['question_text'],
            'p_admin':uid
        }
    )

    try:
        now=datetime.now(timezone.utc).isoformat()
        db(
            'prepared_questions',
            method='PATCH',
            params={'id':'eq.'+qid},
            body={
                'last_published_at':now,
                'updated_at':now
            }
        )
    except ApiError:
        app.logger.warning(
            'Prepared question published; usage timestamp update failed'
        )

    return jsonify(ok=True,publication=published)

# ============================================================
# LIVE POLL — ADMIN API
# Uses SQL functions 19, 20, 21, 22
# ============================================================

def poll_payload():
    data=json_input()

    text=data.get('text')
    options=data.get('options')

    if not isinstance(text,str):
        raise ApiError('შეიყვანე Poll-ის კითხვა')

    text=text.strip()

    if not 1<=len(text)<=200:
        raise ApiError('კითხვა უნდა შეიცავდეს 1–200 სიმბოლოს')

    if not isinstance(options,list):
        raise ApiError('დაამატე პასუხების ვარიანტები')

    if not 2<=len(options)<=12:
        raise ApiError('Poll-ს უნდა ჰქონდეს 2–12 პასუხის ვარიანტი')

    clean=[]
    used_colors=set()

    for index,option in enumerate(options):
        if not isinstance(option,dict):
            raise ApiError('პასუხის ფორმატი არასწორია')

        label=option.get('text')
        color=option.get('color_key')

        if not isinstance(label,str):
            raise ApiError('შეიყვანე პასუხის ტექსტი')

        if not isinstance(color,str):
            raise ApiError('აირჩიე პასუხის ფერი')

        label=label.strip()
        color=color.strip()

        if not 1<=len(label)<=200:
            raise ApiError(
                'თითოეული პასუხი უნდა შეიცავდეს 1–200 სიმბოლოს'
            )

        if color in used_colors:
            raise ApiError('ერთ Poll-ში ფერები არ უნდა განმეორდეს')

        used_colors.add(color)

        clean.append({
            'text':label,
            'color_key':color
        })

    return text,clean

@app.route('/api/admin/polls/palette',methods=['GET'])
def poll_palette_api():
    staff('admin')

    colors=db(
        'poll_palette',
        params={
            'select':'color_key,hex_color,heart,color_name',
            'order':'color_key.asc',
            'limit':'20'
        }
    ) or []

    return jsonify(colors=colors,max_options=12)

@app.route('/api/admin/polls',methods=['GET','POST'])
def polls_api():
    uid,_=staff('admin')

    if request.method=='GET':
        prepared=db(
            'prepared_questions',
            params={
                'question_type':'eq.poll',
                'select':(
                    'id,question_text,question_type,'
                    'sort_order,last_published_at,'
                    'created_at,updated_at'
                ),
                'order':'sort_order.asc',
                'limit':'500'
            }
        ) or []

        options=db(
            'prepared_poll_options',
            params={
                'select':(
                    'id,prepared_question_id,option_text,'
                    'color_key,sort_order'
                ),
                'order':'sort_order.asc',
                'limit':'6000'
            }
        ) or []

        by_question={}

        for option in options:
            key=option['prepared_question_id']
            by_question.setdefault(key,[]).append({
                'id':option['id'],
                'text':option['option_text'],
                'color_key':option['color_key'],
                'sort_order':option['sort_order']
            })

        for item in prepared:
            item['options']=by_question.get(item['id'],[])

        return jsonify(polls=prepared)

    text,options=poll_payload()

    result=db(
        'rpc/save_sportuni_prepared_poll',
        method='POST',
        body={
            'p_text':text,
            'p_admin':uid,
            'p_options':options
        }
    )

    return jsonify(result),201

@app.route('/api/admin/polls/<poll_id>',methods=['PATCH','DELETE'])
def poll_item_api(poll_id):
    uid,_=staff('admin')
    poll_id=prepared_id(poll_id)

    record=prepared_get(poll_id)

    if record.get('question_type')!='poll':
        raise ApiError('ეს ჩანაწერი Poll არ არის',400)

    if request.method=='DELETE':
        db(
            'prepared_questions',
            method='DELETE',
            params={'id':'eq.'+poll_id}
        )
        return jsonify(ok=True)

    text,options=poll_payload()

    result=db(
        'rpc/update_sportuni_prepared_poll',
        method='POST',
        body={
            'p_prepared_id':poll_id,
            'p_text':text,
            'p_admin':uid,
            'p_options':options
        }
    )

    return jsonify(result)

@app.route('/api/admin/polls/<poll_id>/publish',methods=['POST'])
def poll_publish_api(poll_id):
    uid,_=staff('admin')
    poll_id=prepared_id(poll_id)

    record=prepared_get(poll_id)

    if record.get('question_type')!='poll':
        raise ApiError('ეს ჩანაწერი Poll არ არის',400)

    result=db(
        'rpc/publish_sportuni_prepared_poll',
        method='POST',
        body={
            'p_prepared_id':poll_id,
            'p_admin':uid
        }
    )

    return jsonify(result)

@app.route('/api/admin/polls/publish-now',methods=['POST'])
def poll_publish_now_api():
    uid,_=staff('admin')
    text,options=poll_payload()

    result=db(
        'rpc/publish_sportuni_poll',
        method='POST',
        body={
            'p_text':text,
            'p_admin':uid,
            'p_options':options
        }
    )

    return jsonify(result)

# ============================================================
# STUDENT LIVE POLL API
# ============================================================

@app.route('/api/student/poll',methods=['GET'])
def student_poll_status():
    s,q=current()
    d=device()

    if not s:
        raise ApiError('ღონისძიების პარამეტრები ვერ მოიძებნა',503)

    if s.get('student_session_closed',False):
        resp=jsonify(
            ok=True,
            session_closed=True,
            question=None,
            question_type=None,
            options=[],
            intake=False,
            answered=False
        )
        return setdevice(resp,d)

    is_poll=bool(
        q and q.get('question_type')=='poll'
    )

    options=[]
    answered=False

    if is_poll:
        option_rows=db(
            'poll_options',
            params={
                'question_id':'eq.'+q['id'],
                'select':'id,option_text,color_key,sort_order',
                'order':'sort_order.asc',
                'limit':'12'
            }
        ) or []

        palette_rows=db(
            'poll_palette',
            params={
                'select':'color_key,hex_color,heart',
                'limit':'12'
            }
        ) or []

        palette={
            item['color_key']:item
            for item in palette_rows
        }

        for item in option_rows:
            color=palette.get(item['color_key'],{})

            options.append({
                'id':item['id'],
                'text':item['option_text'],
                'color_key':item['color_key'],
                'color':color.get('hex_color','#FDCB4E'),
                'heart':color.get('heart','💛')
            })

        previous_vote=one(
            'poll_votes',
            question_id=q['id'],
            voter_hash=d_hash(d)
        )
        answered=bool(previous_vote)

    resp=jsonify(
        ok=True,
        session_closed=False,
        question={
            'id':q['id'],
            'text':q['text']
        } if q else None,
        question_type=(
            q.get('question_type','text')
            if q else None
        ),
        options=options,
        intake=bool(
            s.get('intake_enabled') and q
        ),
        answered=answered
    )

    return setdevice(resp,d)

@app.route('/api/student/poll/vote',methods=['POST'])
def student_poll_vote():
    data=json_input()

    qid=data.get('qid')
    option_id=data.get('option_id')

    try:
        qid=str(uuid.UUID(str(qid)))
        option_id=str(uuid.UUID(str(option_id)))
    except (ValueError,TypeError,AttributeError):
        raise ApiError('კითხვა ან პასუხის ვარიანტი არასწორია')

    d=device()

    result=db(
        'rpc/submit_sportuni_poll_vote',
        method='POST',
        body={
            'p_question':qid,
            'p_option':option_id,
            'p_hash':d_hash(d)
        }
    )

    if not isinstance(result,dict):
        raise ApiError(
            'ხმის მიცემის შედეგი ვერ დადასტურდა',
            503
        )

    reason=result.get('reason')

    if reason=='session_closed':
        resp=jsonify(
            ok=False,
            reason='session_closed',
            detail='ღონისძიება დასრულებულია'
        )
        response=setdevice(resp,d)
        return response,409

    if reason=='intake_closed':
        resp=jsonify(
            ok=False,
            reason='intake_closed',
            detail='პასუხების მიღება შეჩერებულია'
        )
        response=setdevice(resp,d)
        return response,409

    if reason=='question_changed':
        resp=jsonify(
            ok=False,
            reason='question_changed',
            detail='კითხვა შეიცვალა. განაახლე გვერდი.'
        )
        response=setdevice(resp,d)
        return response,409

    if reason in ('not_a_poll','invalid_option'):
        resp=jsonify(
            ok=False,
            reason=reason,
            detail='არჩეული პასუხი აღარ არის აქტიური'
        )
        response=setdevice(resp,d)
        return response,400

    if result.get('ok') is not True:
        raise ApiError('ხმის მიცემა ვერ შესრულდა',409)

    resp=jsonify(
        ok=True,
        already_voted=bool(
            result.get('already_voted',False)
        )
    )

    return setdevice(resp,d)

# ============================================================
# LIVE POLL PROJECTOR RESULTS
# ============================================================

@app.route('/api/screen/poll',methods=['GET'])
def screen_poll_results():
    settings,active_question=current()

    if not settings:
        raise ApiError('ღონისძიების პარამეტრები ვერ მოიძებნა',503)

    if (
        not active_question
        or active_question.get('question_type')!='poll'
    ):
        return jsonify(
            ok=True,
            active=False,
            screen=settings.get('screen_mode','qr'),
            question=None,
            options=[],
            has_votes=False
        )

    question_id=active_question['id']

    options=db(
        'poll_options',
        params={
            'question_id':'eq.'+question_id,
            'select':'id,option_text,color_key,sort_order',
            'order':'sort_order.asc',
            'limit':'12'
        }
    ) or []

    palette_rows=db(
        'poll_palette',
        params={
            'select':'color_key,hex_color,heart',
            'limit':'12'
        }
    ) or []

    palette={
        item['color_key']:item
        for item in palette_rows
    }

    votes=db(
        'poll_votes',
        params={
            'question_id':'eq.'+question_id,
            'select':'option_id',
            'limit':'10000'
        }
    ) or []

    counts={
        option['id']:0
        for option in options
    }

    for vote in votes:
        option_id=vote.get('option_id')
        if option_id in counts:
            counts[option_id]+=1

    total=sum(counts.values())
    has_votes=total>0

    percentages=[0]*len(options)

    if has_votes:
        raw=[
            counts[option['id']]*100/total
            for option in options
        ]

        percentages=[int(value) for value in raw]

        remaining=100-sum(percentages)

        order=sorted(
            range(len(options)),
            key=lambda index:(
                -(raw[index]-percentages[index]),
                index
            )
        )

        for index in order[:remaining]:
            percentages[index]+=1

    result_options=[]

    for index,option in enumerate(options):
        color=palette.get(option['color_key'],{})

        result_options.append({
            'id':option['id'],
            'text':option['option_text'],
            'color_key':option['color_key'],
            'color':color.get(
                'hex_color',
                '#FDCB4E'
            ),
            'heart':color.get('heart','💛'),
            'percentage':percentages[index]
        })

    return jsonify(
        ok=True,
        active=True,
        screen=settings.get('screen_mode','qr'),
        question={
            'id':question_id,
            'text':active_question['text']
        },
        has_votes=has_votes,
        options=result_options
    )

# ============================================================
# APPLICATION START
# ============================================================

# ============================================================
# SPORTUNI WELCOME 2026
# LATEST PUBLISHED POLL LAYOUT — ADMIN ONLY
# ============================================================

@app.route('/api/admin/polls/latest-layout', methods=['GET'])
def latest_published_poll_layout():
    staff('admin')

    polls = db(
        'questions',
        params={
            'question_type': 'eq.poll',
            'select': 'id,text,created_at',
            'order': 'created_at.desc',
            'limit': '1'
        }
    ) or []

    if not polls:
        return jsonify(ok=True, options=[])

    latest = polls[0]

    rows = db(
        'poll_options',
        params={
            'question_id': 'eq.' + latest['id'],
            'select': 'option_text,color_key,sort_order',
            'order': 'sort_order.asc',
            'limit': '12'
        }
    ) or []

    return jsonify(
        ok=True,
        question=latest['text'],
        options=[
            {
                'text': row['option_text'],
                'color_key': row['color_key']
            }
            for row in rows
        ]
    )

# ============================================================
# END LATEST POLL LAYOUT
# ============================================================

if __name__=="__main__":
    app.run(debug=False,port=8000)
