import psycopg2
import getpass

pw = getpass.getpass("Postgres password: ")

conn = psycopg2.connect(
    host="localhost", port=5432,
    database="trufflehog", user="postgres", password=pw
)
cur = conn.cursor()

def banner():
    print("\n=== TruffleHog DB Viewer ===")
    print("1. Summary stats")
    print("2. Browse findings")
    print("3. View full finding by ID")
    print("4. Search by detector")
    print("5. Verified only")
    print("q. Quit")

def stats():
    cur.execute("SELECT COUNT(*), COUNT(*) FILTER (WHERE verified), COUNT(*) FILTER (WHERE status='open') FROM findings")
    total, verified, open_ = cur.fetchone()
    cur.execute("SELECT detector_name, COUNT(*) FROM findings GROUP BY detector_name ORDER BY COUNT(*) DESC LIMIT 10")
    print(f"\nTotal: {total}  Verified: {verified}  Open: {open_}\n\nTop detectors:")
    for name, count in cur.fetchall():
        print(f"  {count:>5}  {name}")

def browse(where="", params=()):
    cur.execute(f"""
        SELECT id, detector_name, verified, status, severity_score,
               LEFT(raw_secret, 60), repository
        FROM findings {where}
        ORDER BY severity_score DESC, id DESC LIMIT 50
    """, params)
    print(f"\n{'ID':<8}{'DETECTOR':<28}{'V':<5}{'STATUS':<10}{'SEV':<5}{'SECRET':<62}REPO")
    print("-" * 130)
    for r in cur.fetchall():
        print(f"{r[0]:<8}{(r[1] or '')[:27]:<28}{'YES' if r[2] else 'no':<5}{(r[3] or ''):<10}{str(r[4]):<5}{(r[5] or ''):<62}{r[6] or ''}")

def view_one(id_):
    cur.execute("SELECT * FROM findings WHERE id = %s", (id_,))
    row = cur.fetchone()
    if not row:
        print("Not found."); return
    for col, val in zip([d[0] for d in cur.description], row):
        if val is not None and str(val).strip():
            print(f"  {col:<30} {val}")

while True:
    banner()
    c = input("\n> ").strip().lower()
    if c == "q": break
    elif c == "1": stats()
    elif c == "2": browse()
    elif c == "3": view_one(input("ID: ").strip())
    elif c == "4": browse("WHERE detector_name ILIKE %s", (f"%{input('Detector: ').strip()}%",))
    elif c == "5": browse("WHERE verified = true")

cur.close(); conn.close()
