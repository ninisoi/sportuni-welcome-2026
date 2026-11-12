
"""
SPORTUNI WELCOME 2026
Rotating QR access and student session protection.
"""

import hashlib
import hmac
import io
import os
import uuid
from urllib.parse import quote

from flask import (
    Response,
    jsonify,
    make_response,
    redirect,
    request
)

from itsdangerous import (
    URLSafeTimedSerializer,
    BadSignature,
    SignatureExpired
)


COOKIE = "su_qr_access"
TTL = 60 * 60 * 8


def install_qr_access(
    app,
    setting,
    db,
    staff,
    json_input
):

    secret = os.environ.get(
        "FLASK_SECRET_KEY", ""
    )

    def signer(salt):
        if len(secret) < 32:
            raise RuntimeError(
                "FLASK_SECRET_KEY is missing"
            )

        return URLSafeTimedSerializer(
            secret,
            salt=salt
        )

    def revision(settings):
        value = str(
            settings["qr_access_generation"]
        )

        return hmac.new(
            secret.encode(),
            value.encode(),
            hashlib.sha256
        ).hexdigest()

    def cookie_is_valid(settings):
        token = request.cookies.get(
            COOKIE, ""
        )

        if not token:
            return False

        try:
            data = signer(
                "su-qr-cookie-v1"
            ).loads(
                token,
                max_age=TTL
            )

            return hmac.compare_digest(
                str(data.get("v", "")),
                revision(settings)
            )

        except (
            BadSignature,
            SignatureExpired,
            ValueError,
            TypeError
        ):
            return False

    def entry_is_valid(settings, token):
        if not token:
            return False

        try:
            data = signer(
                "su-qr-entry-v1"
            ).loads(
                token,
                max_age=TTL
            )

            return hmac.compare_digest(
                str(data.get("v", "")),
                revision(settings)
            )

        except (
            BadSignature,
            SignatureExpired,
            ValueError,
            TypeError
        ):
            return False

    # ------------------------------------------
    # STUDENT ACCESS STATUS
    # ------------------------------------------

    @app.route(
        "/api/student/access-state",
        methods=["GET"]
    )
    def student_access_state():
        s = setting()

        if not s:
            return jsonify(
                ok=False
            ), 503

        return jsonify(
            ok=True,
            session_closed=bool(
                s.get("student_session_closed")
            ),
            qr_required=not cookie_is_valid(s)
        )

    # ------------------------------------------
    # INDEPENDENT STUDENT PAGES
    # ------------------------------------------

    def make_page(title, message, symbol):
        return """
<!doctype html>
<html lang="ka">
<head>
<meta charset="UTF-8">
<meta name="viewport"
      content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#093759">

<title>SPORTUNI WELCOME 2026</title>

<style>
* { box-sizing: border-box; }

body {
    margin: 0;
    min-height: 100svh;
    display: grid;
    place-items: center;
    font-family: system-ui,
      "Noto Sans Georgian", sans-serif;
    color: white;
    background:
      radial-gradient(
        circle at 80% 10%,
        #195982,
        transparent 44%
      ),
      linear-gradient(
        155deg,
        #093759,
        #041d32
      );
}

main {
    width: min(90%, 460px);
    padding: 48px 25px;
    text-align: center;
    border: 1px solid #ffffff30;
    border-radius: 28px;
    background: #ffffff10;
    box-shadow: 0 20px 70px #0004;
}

.brand {
    font-size: 20px;
    font-weight: 900;
}

.brand b {
    color: #FDCB4E;
}

.symbol {
    font-size: 58px;
    margin: 30px 0 10px;
}

h1 {
    font-size: clamp(25px, 6vw, 34px);
    line-height: 1.35;
}

p {
    color: #cbdde9;
    line-height: 1.9;
    font-size: 15px;
}

footer {
    margin-top: 40px;
    font-size: 11px;
    color: #afc7d7;
}
</style>
</head>

<body>

<main>
    <div class="brand">
        SPORT<b>UNI</b> ✦ WELCOME 2026
    </div>

    <div class="symbol">__SYMBOL__</div>

    <h1>__TITLE__</h1>

    <p>__MESSAGE__</p>

    <footer>
        ჩემპიონები სწავლობენ აქ
    </footer>
</main>

__EXTRA_SCRIPT__

</body>
</html>
""".replace(
            "__SYMBOL__", symbol
        ).replace(
            "__TITLE__", title
        ).replace(
            "__MESSAGE__", message
        )

    @app.route("/thank-you")
    def thank_you_page():
        html = make_page(
            "მადლობა მონაწილეობისთვის!",
            "SPORTUNI WELCOME 2026-ის "
            "სტუდენტური სესია დასრულებულია.",
            "💛"
        )

        script = """
<script>
setInterval(async () => {
    try {
        const response = await fetch(
            "/api/student/access-state",
            {cache: "no-store"}
        );

        const state = await response.json();

        if (!state.session_closed) {
            location.replace("/scan-qr");
        }
    } catch (error) {}
}, 2000);
</script>
"""

        html = html.replace(
            "__EXTRA_SCRIPT__",
            script
        )

        return Response(
            html,
            mimetype="text/html"
        )

    @app.route("/scan-qr")
    def scan_qr_page():
        html = make_page(
            "დაასკანერე ახალი QR კოდი",
            "მონაწილეობის გასაგრძელებლად "
            "გამოიყენე ღონისძიების ეკრანზე "
            "ნაჩვენები ახალი QR კოდი. "
            "ძველი ბმულით პასუხის გაცემა "
            "შეუძლებელია.",
            "▦"
        )

        html = html.replace(
            "__EXTRA_SCRIPT__", ""
        )

        return Response(
            html,
            mimetype="text/html"
        )

    # ------------------------------------------
    # SECURITY CHECK BEFORE REQUESTS
    # ------------------------------------------

    @app.before_request
    def student_qr_guard():

        path = request.path

        # Admin session changes are handled by app.py.
        # QR protection must not intercept this endpoint.
        if path == "/api/admin/student-session":
            return None

        protected = (
            "/join",
            "/confirmation",
            "/api/qr.svg",
            "/api/admin/student-session"
        )

        if (
            path not in protected
            and not path.startswith("/api/student/")
        ):
            return None

        # --------------------------------------
        # ADMIN CLOSE / REOPEN
        # --------------------------------------

        if path == "/api/admin/student-session":

            if request.method != "POST":
                return None

            staff("admin")

            payload = json_input()
            closed = payload.get("closed")

            if type(closed) is not bool:
                return jsonify(
                    detail="სესიის სტატუსი არასწორია"
                ), 400

            values = {
                "student_session_closed": closed,
                "intake_enabled": not closed
            }

            # Closing invalidates every old QR
            # token and every student access cookie.
            if closed:
                values["qr_access_generation"] = (
                    str(uuid.uuid4())
                )

            rows = db(
                "event_settings",
                method="PATCH",
                params={
                    "id": "eq.1",
                    "select": (
                        "student_session_closed,"
                        "intake_enabled"
                    )
                },
                body=values,
                prefer="return=representation"
            )

            if not rows:
                return jsonify(
                    detail=(
                        "სესიის მდგომარეობა "
                        "ვერ დადასტურდა"
                    )
                ), 503

            return jsonify(
                ok=True,
                closed=bool(
                    rows[0]["student_session_closed"]
                ),
                intake=bool(
                    rows[0]["intake_enabled"]
                )
            )

        # --------------------------------------
        # READ CURRENT SESSION
        # --------------------------------------

        settings = setting()

        if not settings:
            return jsonify(
                detail=(
                    "სესიის პარამეტრები "
                    "ვერ მოიძებნა"
                )
            ), 503

        # --------------------------------------
        # QR IMAGE WITH ROTATING ACCESS TOKEN
        # --------------------------------------

        if path == "/api/qr.svg":

            import qrcode
            from qrcode.image.svg import SvgPathImage

            token = signer(
                "su-qr-entry-v1"
            ).dumps({
                "v": revision(settings)
            })

            origin = (
                os.environ.get(
                    "PUBLIC_BASE_URL", ""
                ).rstrip("/")
                or request.url_root.rstrip("/")
            )

            url = (
                origin
                + "/join?entry="
                + quote(token, safe="")
            )

            qr = qrcode.make(
                url,
                image_factory=SvgPathImage,
                box_size=8,
                border=3
            )

            output = io.BytesIO()
            qr.save(output)

            return Response(
                output.getvalue(),
                mimetype="image/svg+xml",
                headers={
                    "Cache-Control":
                        "no-store, max-age=0"
                }
            )

        closed = bool(
            settings.get(
                "student_session_closed"
            )
        )

        # --------------------------------------
        # ENTRY TO STUDENT PAGE
        # --------------------------------------

        if path in (
            "/join",
            "/confirmation"
        ):

            if closed:
                return redirect(
                    "/thank-you",
                    code=302
                )

            entry = request.args.get(
                "entry", ""
            )

            if entry and entry_is_valid(
                settings, entry
            ):

                response = make_response(
                    redirect(
                        "/join",
                        code=302
                    )
                )

                response.set_cookie(
                    COOKIE,
                    signer(
                        "su-qr-cookie-v1"
                    ).dumps({
                        "v": revision(settings)
                    }),
                    max_age=TTL,
                    httponly=True,
                    secure=request.is_secure,
                    samesite="Lax",
                    path="/"
                )

                return response

            if not cookie_is_valid(settings):
                return redirect(
                    "/scan-qr",
                    code=302
                )

            return None

        # --------------------------------------
        # ACCESS STATUS HAS ITS OWN ENDPOINT
        # --------------------------------------

        if path == "/api/student/access-state":
            return None

        # --------------------------------------
        # BLOCK STUDENT API AFTER CLOSE
        # --------------------------------------

        if closed:

            if request.method == "GET":
                return jsonify(
                    ok=True,
                    session_closed=True,
                    question=None,
                    question_type=None,
                    options=[],
                    answered=False,
                    intake=False
                )

            return jsonify(
                ok=False,
                reason="session_closed",
                detail="ღონისძიება დასრულებულია"
            ), 409

        # --------------------------------------
        # BLOCK EXPIRED / OLD QR ACCESS
        # --------------------------------------

        if not cookie_is_valid(settings):
            return jsonify(
                ok=False,
                qr_required=True,
                reason="qr_required",
                detail="დაასკანერეთ ახალი QR კოდი"
            ), 403

        return None

    # ------------------------------------------
    # MONITOR ALREADY OPEN STUDENT PAGES
    # ------------------------------------------

    @app.after_request
    def add_student_access_monitor(response):

        if request.path not in (
            "/join",
            "/confirmation"
        ):
            return response

        if (
            response.status_code != 200
            or response.mimetype != "text/html"
        ):
            return response

        
        # Allow safe modification of the HTML response.
        response.direct_passthrough = False

        html = response.get_data(
            as_text=True
        )


        script = """
<script>
(() => {
    let navigating = false;

    async function checkAccess() {
        if (navigating) return;

        try {
            const response = await fetch(
                "/api/student/access-state",
                {
                    cache: "no-store",
                    credentials: "same-origin"
                }
            );

            if (!response.ok) return;

            const state = await response.json();

            if (
                state.session_closed ||
                state.qr_required
            ) {
                navigating = true;

                location.replace(
                    state.session_closed
                        ? "/thank-you"
                        : "/scan-qr"
                );
            }
        } catch (error) {}
    }

    checkAccess();

    setInterval(checkAccess, 1800);

    document.addEventListener(
        "visibilitychange",
        () => {
            if (!document.hidden) {
                checkAccess();
            }
        }
    );
})();
</script>
"""

        if "</body>" in html:
            response.set_data(
                html.replace(
                    "</body>",
                    script + "</body>"
                )
            )

        return response
