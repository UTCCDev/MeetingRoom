"""Build the review Excel + import JSON from the legacy กองอาคาร booking exports.

Inputs  (old/opf/, not in git): MeetingRoom.xlsm, MeetingRoom2.xlsm, rooms.json
        rooms.json comes from: node scripts/opf-export-rooms.js
Outputs (old/opf/): opf-migration-review-v2.xlsx (for human review), opf-bookings.json (for import-opf.js)

Usage:  pip install openpyxl && python scripts/opf-build.py
See README "ย้ายข้อมูลการจองจากระบบเดิม (กองอาคาร)".
"""
import openpyxl,collections,re,json,sys,datetime as dt
from openpyxl.styles import Font,PatternFill,Alignment
S='old/opf'
r1=list(openpyxl.load_workbook('old/opf/MeetingRoom.xlsm',read_only=True,data_only=True).active.iter_rows(values_only=True))
r2=list(openpyxl.load_workbook('old/opf/MeetingRoom2.xlsm',read_only=True,data_only=True).active.iter_rows(values_only=True))[1:]
rooms={r['code']:r for r in json.load(open(S+'/rooms.json',encoding='utf8'))}
MAP={ # old code -> (new code, confidence, note)
 'B15F1':('E150101','สูง','หอประชุมใหญ่ อาคาร 15'),
 'B3F4':('E030401','สูง','ห้องไทรทอง อาคาร 3 ชั้น 4'),
 'B10F3':('E100301','สูง','โถงจัดเลี้ยง อาคาร 10 ชั้น 3'),
 'B5F9':('E050901','สูง','UNICON HALL อาคาร 5 ชั้น 9'),
 'B10F5QPS':('M100503','สูง','ห้องประชุมกองประกันคุณภาพฯ อาคาร 10 ชั้น 5'),
 'B21F7(Chicago)':('M210704','สูง','Chicago Meeting room อาคาร 21 ชั้น 7'),
 'B24F18':('E241801','กลาง','อาคาร 24 ชั้น 18 (ห้องประชุม/ห้องแถลงข่าว)'),
 'B15F1SBF':('M000101','กลาง','ห้องประชุมกองอาคาร (แผนกซ่อมบำรุง)'),
 'B7F12':('E071201','ต่ำ','ระบบเดิม = ห้องอาหารอาคาร 7 ชั้น 12 / ระบบเรา = ห้อง Pantry (คณะวิทยพัฒน์)'),
 'B10F2':('S100201','ต่ำ','ระบบเดิม = อาคาร 10 ชั้น 2 (ห้องประชุม) / ระบบเรา = ห้องเรียน 10201'),
}
desc={x[2]:x[3] for x in r2}
def hhmm(p): return dt.time(7+p,0)  # ASSUMPTION P1=08:00
def runs(pat):
  out=[];i=0
  while i<13:
    if pat[i]=='R':
      j=i
      while j<13 and pat[j]=='R': j+=1
      out.append((i+1,j)); i=j
    else: i+=1
  return out
by_id=collections.defaultdict(list); by_key=collections.defaultdict(list)
for x in r2:
  by_id[x[0]].append(x); by_key[(x[2],x[5].date(),x[32].strip())].append(x)
used=set()
h=r1[0]; rows=[]; skipped=collections.Counter(); now=dt.datetime.now()
for x in r1[1:]:
  d=dict(zip(h,x)); old=d['Details']
  title=re.sub(r'\s*\(\d+\)\s*$','',d['Question'] or '').strip()
  if old not in MAP: skipped[old]+=1; continue
  code,conf,_=MAP[old]; rm=rooms[code]; date=d['DateBUse'].date()
  m=by_id.get(d['Reply']) or by_key.get((old,date,title)) or []
  m=[y for y in m if y[0] not in used]
  status='APPROVED' if d['Approved']=='Reserved' else 'CANCELLED'
  slots=[]; src='ไม่มีช่วงเวลา (ระบบเดิมเก็บแค่วันที่) → เต็มวัน 08:00-20:00'
  for y in m:
    used.add(y[0]); src='MeetingRoom2 iDres=%s'%y[0]
    slots+=runs(''.join(y[8:21]))
  full=not slots
  if full: slots=[(1,12)]
  att=int(d['AM'] or 0)
  for a,b in slots:
    st=dt.datetime.combine(date,hhmm(a)); en=dt.datetime.combine(date,hhmm(min(b+1,13)))  # full day ends 20:00
    flags=[]
    if conf!='สูง': flags.append('ตรวจ mapping ห้อง (%s)'%conf)
    if att>rm['capacity']: flags.append('ผู้เข้าร่วมเกินความจุ')
    if len(slots)>1: flags.append('แยกเป็นหลายช่วงในวันเดียว')
    rows.append([d['QuestionID'],d['Reply'],old,desc.get(old,''),code,rm['name'],rm['description'],conf,
      title,(d['Question'] or '').strip(),st,en,'P%d-P%d'%(a,b),max(att,1),status,
      'อดีต' if en<now else 'อนาคต',d['Name'],d['CreateDate'],d['Remark'] or '',rm['roomAdmin']['email'],src,'; '.join(flags)])
# overlap check among APPROVED
ap=sorted([r for r in rows if r[14]=='APPROVED'],key=lambda r:(r[4],r[10]))
for i in range(1,len(ap)):
  p,c=ap[i-1],ap[i]
  if p[4]==c[4] and c[10]<p[11]:
    for r,o in ((c,p),(p,c)): r[21]=(r[21]+'; ' if r[21] else '')+'ชนกับ old#%s'%o[1]
rows.sort(key=lambda r:(r[10],r[4]))
wb=openpyxl.Workbook(); ws=wb.active; ws.title='Bookings'
H=['old_QuestionID','old_ReserveID','old_room','old_room_desc','room_code','room_name','room_desc','mapping_confidence','title','old_title_raw','startTime','endTime','periods','attendees','status','past_future','booked_by_name(old)','old_createDate','old_remark','room_admin_email','time_source','flags']
ws.append(H)
for r in rows: ws.append(r)
for c in ws[1]: c.font=Font(bold=True,color='FFFFFF'); c.fill=PatternFill('solid',fgColor='1F4E78')
yel=PatternFill('solid',fgColor='FFF2CC')
for row in ws.iter_rows(min_row=2):
  row[10].number_format=row[11].number_format=row[17].number_format='yyyy-mm-dd hh:mm'
  if row[21].value:
    for c in row: c.fill=yel
for col,w in zip('ABCDEFGHIJKLMNOPQRSTUV',[10,10,14,30,10,24,34,10,40,40,16,16,9,8,11,8,24,16,30,22,30,40]): ws.column_dimensions[col].width=w
ws.freeze_panes='A2'; ws.auto_filter.ref=ws.dimensions
m=wb.create_sheet('RoomMapping'); m.append(['old_code','old_desc','new_code','new_name','new_desc','confidence','note','rows'])
cnt=collections.Counter(r[2] for r in rows)
for k,(c,conf,n) in MAP.items(): m.append([k,desc.get(k,''),c,rooms[c]['name'],rooms[c]['description'],conf,n,cnt[k]])
s=wb.create_sheet('Skipped'); s.append(['old_code','old_desc','rows (ไม่มีห้องในระบบเรา)'])
for k,v in skipped.most_common(): s.append([k,desc.get(k,''),v])
u=wb.create_sheet('File2Unmatched'); u.append(['iDres','room','date','periods','title','name'])
for y in r2:
  if y[0] not in used and y[2] in MAP: u.append([y[0],y[2],y[5],''.join(y[8:21]),y[32],y[7]])
n=wb.create_sheet('Notes')
for t in ['แหล่งข้อมูล: MeetingRoom.xlsm (หัวการจอง %d แถว) + MeetingRoom2.xlsm (ช่วงเวลารายวัน P1-P13, %d แถว) join ด้วย Reply=iDres แล้ว fallback ห้อง+วัน+ชื่อเรื่อง'%(len(r1)-1,len(r2)),
 'ช่วงเวลา: P1 เริ่ม 08:00 ชั่วโมงละ 1 period, เวลาจบสูงสุด 20:00 (จองครบ P1-P13 = เต็มวัน 08:00-20:00)',
 'การจองที่ไม่มีใน MeetingRoom2 (ส่วนใหญ่เป็นอดีต) ไม่มีเวลา → เต็มวัน 08:00-20:00',
 'จำนวนผู้เข้าร่วม: ระบบเดิมส่วนใหญ่เป็น 0 → ใส่ 1',
 'สถานะ: Reserved→APPROVED, Cancel→CANCELLED',
 'ผู้จอง: ทุกแถว map เป็น admin20@utcc.ac.th (กองอาคารและสิ่งแวดล้อม) ชื่อผู้จองเดิมเก็บไว้ใน description',
 'แถวสีเหลือง = มี flag ควรตรวจ',
 'รวมนำเข้า %d แถว (APPROVED %d / CANCELLED %d) | ข้าม %d แถวเพราะไม่มีห้องในระบบ'%(len(rows),sum(r[14]=='APPROVED' for r in rows),sum(r[14]=='CANCELLED' for r in rows),sum(skipped.values())),
 'MeetingRoom2 แถวที่ไม่ถูก join: %d'%sum(1 for y in r2 if y[0] not in used and y[2] in MAP)]: n.append([t])
n.column_dimensions['A'].width=130
wb.save(S+'/opf-migration-review-v2.xlsx')
json.dump([dict(zip(H,r)) for r in rows],open(S+'/opf-bookings.json','w',encoding='utf8'),ensure_ascii=False,default=str)
print('rows:', len(rows), '| skipped (room not in system):', skipped.total())
print('flags:', collections.Counter(f for r in rows for f in r[21].split('; ') if f).most_common(5))
