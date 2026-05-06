const API = 'http://192.168.2.127/api';
let currentPage = 'dashboard';
let modalType = null, modalId = null;
let allPersons = [], allCompanies = [], allRelations = [];
let netShowLabels = true, netSim, netSvg, netZoom, netG;
let searchTimers = {};

// ================================================================
// UTILS
// ================================================================
function toast(msg, type='ok'){
  const t=document.getElementById('toast');
  t.textContent=msg; t.className=type; t.style.display='block';
  setTimeout(()=>t.style.display='none',3000);
}
async function api(path, method='GET', body=null){
  const opts={method, headers:{'Content-Type':'application/json'}};
  if(body) opts.body=JSON.stringify(body);
  const res=await fetch(API+path, opts);
  if(!res.ok){const e=await res.json();throw new Error(e.error||'خطأ');}
  return res.json();
}
function debounce(fn, key, ms=350){
  clearTimeout(searchTimers[key]);
  searchTimers[key]=setTimeout(fn,ms);
}

// ================================================================
// NAV
// ================================================================
function showPage(name){
  document.querySelectorAll('.page').forEach(p=>p.style.display='none');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+name).style.display='block';
  document.querySelector(`[data-page="${name}"]`).classList.add('active');
  currentPage=name;
  if(name==='dashboard') loadDashboard();
  else if(name==='persons') loadPersons();
  else if(name==='companies') loadCompanies();
  else if(name==='relations') loadRelations();
  else if(name==='network') loadNetwork();
}

// ================================================================
// DASHBOARD
// ================================================================
async function loadDashboard(){
  try{
    const s=await api('/stats');
    document.getElementById('stat-persons').textContent=s.persons;
    document.getElementById('stat-companies').textContent=s.companies;
    document.getElementById('stat-relations').textContent=s.relations;
    document.getElementById('stat-network').textContent=s.persons+s.companies;
    document.getElementById('ns-persons').textContent=s.persons;
    document.getElementById('ns-companies').textContent=s.companies;
    document.getElementById('ns-relations').textContent=s.relations;
    document.getElementById('top-persons-body').innerHTML=s.top_persons.map((p,i)=>`
      <tr><td style="color:var(--text2);width:30px">${i+1}</td>
      <td style="font-weight:600">${p.name}</td>
      <td><span class="badge badge-gold">${p.cnt} علاقة</span></td></tr>`).join('');
    document.getElementById('top-companies-body').innerHTML=s.top_companies.map((c,i)=>`
      <tr><td style="color:var(--text2);width:30px">${i+1}</td>
      <td style="font-weight:600">${c.name}</td>
      <td><span class="badge badge-blue">${c.cnt} علاقة</span></td></tr>`).join('');
  }catch(e){toast('خطأ في تحميل الإحصائيات','err');}
}

// ================================================================
// PERSONS
// ================================================================
async function loadPersons(){
  const body=document.getElementById('persons-body');
  body.innerHTML='<tr><td colspan="7" class="loading">جاري التحميل...</td></tr>';
  try{
    allPersons=await api('/persons');
    document.getElementById('persons-count').textContent=`الأشخاص (${allPersons.length})`;
    renderPersons(allPersons);
  }catch(e){body.innerHTML='<tr><td colspan="7" class="loading">خطأ في التحميل</td></tr>';}
}
function renderPersons(data){
  const natColors={'سوري':'green','لبناني':'blue','إماراتي':'gold','سعودي':'red','إيراني':'purple','أردني':'green','فلسطيني':'gold'};
  document.getElementById('persons-body').innerHTML=data.length?data.map((p,i)=>`
    <tr>
      <td style="color:var(--text2)">${i+1}</td>
      <td><strong>${p.name}</strong>${p.family?`<br><small style="color:var(--text2)">عائلة: ${p.family}</small>`:''}</td>
      <td><span class="badge badge-${natColors[p.nationality]||'blue'}">${p.nationality||'—'}</span></td>
      <td>${p.family||'—'}</td>
      <td style="color:var(--text2);font-size:11px">${p.field||'—'}</td>
      <td><span class="badge badge-gold">${p.relations_count||0}</span></td>
      <td><div class="actions">
        <button class="btn btn-blue" onclick="viewPerson(${p.id})">👁️</button>
        <button class="btn btn-ghost" style="padding:5px 10px;font-size:11px" onclick="editPerson(${p.id})">✏️</button>
        <button class="btn btn-red" onclick="deletePerson(${p.id},'${p.name.replace("'","\\'")}')">🗑️</button>
      </div></td>
    </tr>`).join(''):'<tr><td colspan="7" class="empty"><div class="icon">👤</div>لا يوجد أشخاص</td></tr>';
}
function searchPersons(v){
  debounce(async()=>{
    try{
      const data=await api(`/persons?search=${encodeURIComponent(v)}`);
      renderPersons(data);
    }catch(e){}
  },'persons');
}
async function viewPerson(id){
  try{
    const p=await api(`/persons/${id}`);
    openModal('person-view',id,p);
  }catch(e){toast('خطأ','err');}
}
async function editPerson(id){
  try{
    const p=await api(`/persons/${id}`);
    openModal('person',id,p);
  }catch(e){toast('خطأ','err');}
}
async function deletePerson(id,name){
  if(!confirm(`حذف "${name}" وكل علاقاته؟`)) return;
  try{
    await api(`/persons/${id}`,'DELETE');
    toast('تم الحذف ✅');
    loadPersons(); loadDashboard();
  }catch(e){toast('خطأ في الحذف','err');}
}

// ================================================================
// COMPANIES
// ================================================================
async function loadCompanies(){
  const body=document.getElementById('companies-body');
  body.innerHTML='<tr><td colspan="8" class="loading">جاري التحميل...</td></tr>';
  try{
    allCompanies=await api('/companies');
    document.getElementById('companies-count').textContent=`الشركات (${allCompanies.length})`;
    renderCompanies(allCompanies);
  }catch(e){body.innerHTML='<tr><td colspan="8" class="loading">خطأ في التحميل</td></tr>';}
}
function renderCompanies(data){
  document.getElementById('companies-body').innerHTML=data.length?data.map((c,i)=>`
    <tr>
      <td style="color:var(--text2)">${i+1}</td>
      <td><strong>${c.name}</strong>${c.city?`<br><small style="color:var(--text2)">📍 ${c.city}</small>`:''}</td>
      <td style="color:var(--text2);font-size:11px">${c.sector||'—'}</td>
      <td>${c.city||'—'}</td>
      <td style="font-size:11px">${c.capital||'—'}</td>
      <td><span class="badge badge-${c.status==='نشطة'?'green':'red'}">${c.status||'—'}</span></td>
      <td><span class="badge badge-blue">${c.relations_count||0}</span></td>
      <td><div class="actions">
        <button class="btn btn-blue" onclick="viewCompany(${c.id})">👁️</button>
        <button class="btn btn-ghost" style="padding:5px 10px;font-size:11px" onclick="editCompany(${c.id})">✏️</button>
        <button class="btn btn-red" onclick="deleteCompany(${c.id},'${c.name.replace("'","\\'")}')">🗑️</button>
      </div></td>
    </tr>`).join(''):'<tr><td colspan="8" class="empty"><div class="icon">🏢</div>لا يوجد شركات</td></tr>';
}
function searchCompanies(v){
  debounce(async()=>{
    try{const data=await api(`/companies?search=${encodeURIComponent(v)}`);renderCompanies(data);}catch(e){}
  },'companies');
}
async function viewCompany(id){
  try{const c=await api(`/companies/${id}`);openModal('company-view',id,c);}catch(e){toast('خطأ','err');}
}
async function editCompany(id){
  try{const c=await api(`/companies/${id}`);openModal('company',id,c);}catch(e){toast('خطأ','err');}
}
async function deleteCompany(id,name){
  if(!confirm(`حذف "${name}" وكل علاقاتها؟`)) return;
  try{
    await api(`/companies/${id}`,'DELETE');
    toast('تم الحذف ✅'); loadCompanies(); loadDashboard();
  }catch(e){toast('خطأ في الحذف','err');}
}

// ================================================================
// RELATIONS
// ================================================================
async function loadRelations(){
  const body=document.getElementById('relations-body');
  body.innerHTML='<tr><td colspan="7" class="loading">جاري التحميل...</td></tr>';
  try{
    allRelations=await api('/relations');
    document.getElementById('relations-count').textContent=`العلاقات (${allRelations.length})`;
    renderRelations(allRelations);
  }catch(e){body.innerHTML='<tr><td colspan="7" class="loading">خطأ</td></tr>';}
}
function renderRelations(data){
  const roleColors={'الشريك المؤسس':'gold','مؤسس':'gold','رئيس مجلس الإدارة':'red','مدير الشركة':'blue','المدير العام':'green','عضو مجلس الإدارة':'purple','مدير':'blue'};
  document.getElementById('relations-body').innerHTML=data.length?data.map((r,i)=>`
    <tr>
      <td style="color:var(--text2)">${i+1}</td>
      <td><strong>${r.person_name}</strong></td>
      <td style="color:var(--blue)">${r.company_name}</td>
      <td><span class="badge badge-${roleColors[r.role]||'blue'}">${r.role}</span></td>
      <td style="color:var(--gold)">${r.percentage?r.percentage+'%':'—'}</td>
      <td style="color:var(--text2);font-size:11px">${r.shares||'—'}</td>
      <td><div class="actions">
        <button class="btn btn-ghost" style="padding:5px 10px;font-size:11px" onclick="editRelation(${r.id})">✏️</button>
        <button class="btn btn-red" onclick="deleteRelation(${r.id})">🗑️</button>
      </div></td>
    </tr>`).join(''):'<tr><td colspan="7" class="empty"><div class="icon">🔗</div>لا يوجد علاقات</td></tr>';
}
function searchRelations(v){
  const filtered=allRelations.filter(r=>
    r.person_name?.includes(v)||r.company_name?.includes(v)||r.role?.includes(v));
  renderRelations(filtered);
}
async function editRelation(id){
  const r=allRelations.find(x=>x.id===id);
  if(r) openModal('relation',id,r);
}
async function deleteRelation(id){
  if(!confirm('حذف هذه العلاقة؟')) return;
  try{
    await api(`/relations/${id}`,'DELETE');
    toast('تم الحذف ✅'); loadRelations(); loadDashboard();
  }catch(e){toast('خطأ في الحذف','err');}
}

// ================================================================
// MODAL
// ================================================================
function openModal(type, id=null, data={}){
  modalType=type; modalId=id;
  const titles={'person':'شخص','company':'شركة','relation':'علاقة','person-view':'تفاصيل شخص','company-view':'تفاصيل شركة'};
  document.getElementById('modal-title').textContent=(id&&!type.includes('view')?'تعديل ':'إضافة ')+titles[type];
  document.getElementById('modal-save').style.display=type.includes('view')?'none':'block';

  if(type==='person') renderPersonForm(data);
  else if(type==='company') renderCompanyForm(data);
  else if(type==='relation') renderRelationForm(data);
  else if(type==='person-view') renderPersonView(data);
  else if(type==='company-view') renderCompanyView(data);

  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal(){document.getElementById('modal-overlay').classList.remove('open'); modalType=null; modalId=null;}
function closeModalOnBg(e){if(e.target===document.getElementById('modal-overlay')) closeModal();}

async function saveModal(){
  try{
    if(modalType==='person') await savePersonForm();
    else if(modalType==='company') await saveCompanyForm();
    else if(modalType==='relation') await saveRelationForm();
  }catch(e){toast(e.message,'err');}
}

// --- Person Form ---
function renderPersonForm(d={}){
  document.getElementById('modal-body').innerHTML=`
  <div class="form-grid">
    <div class="form-row"><label>الاسم الكامل *</label><input id="f-name" value="${d.name||''}"></div>
    <div class="form-row"><label>الاسم بالإنجليزي</label><input id="f-name-en" value="${d.name_en||''}"></div>
  </div>
  <div class="form-grid">
    <div class="form-row"><label>الجنسية</label>
      <select id="f-nat">
        ${['سوري','لبناني','إماراتي','سعودي','إيراني','أردني','فلسطيني','عراقي','جزائري','أخرى']
          .map(n=>`<option${d.nationality===n?' selected':''}>${n}</option>`).join('')}
      </select>
    </div>
    <div class="form-row"><label>بلد الإقامة</label><input id="f-residence" value="${d.residence||''}"></div>
  </div>
  <div class="form-grid">
    <div class="form-row"><label>العائلة / المجموعة</label><input id="f-family" value="${d.family||''}"></div>
    <div class="form-row"><label>المجال</label><input id="f-field" value="${d.field||''}"></div>
  </div>
  <div class="form-row"><label>ملاحظات</label><textarea id="f-notes">${d.notes||''}</textarea></div>`;
}
async function savePersonForm(){
  const body={
    name:document.getElementById('f-name').value.trim(),
    name_en:document.getElementById('f-name-en').value.trim(),
    nationality:document.getElementById('f-nat').value,
    residence:document.getElementById('f-residence').value.trim(),
    family:document.getElementById('f-family').value.trim(),
    field:document.getElementById('f-field').value.trim(),
    notes:document.getElementById('f-notes').value.trim()
  };
  if(!body.name) throw new Error('الاسم مطلوب');
  if(modalId) await api(`/persons/${modalId}`,'PUT',body);
  else await api('/persons','POST',body);
  toast(modalId?'تم التعديل ✅':'تمت الإضافة ✅');
  closeModal(); loadPersons(); loadDashboard();
}

// --- Company Form ---
function renderCompanyForm(d={}){
  document.getElementById('modal-body').innerHTML=`
  <div class="form-grid">
    <div class="form-row"><label>اسم الشركة *</label><input id="f-name" value="${d.name||''}"></div>
    <div class="form-row"><label>الاسم بالإنجليزي</label><input id="f-name-en" value="${d.name_en||''}"></div>
  </div>
  <div class="form-grid">
    <div class="form-row"><label>النوع</label>
      <select id="f-type">
        ${['محدودة المسؤولية','مساهمة مغفلة','مساهمة عامة','فردية','أخرى']
          .map(t=>`<option${d.type===t?' selected':''}>${t}</option>`).join('')}
      </select>
    </div>
    <div class="form-row"><label>الحالة</label>
      <select id="f-status">
        ${['نشطة','متوقفة','منحلة'].map(s=>`<option${d.status===s?' selected':''}>${s}</option>`).join('')}
      </select>
    </div>
  </div>
  <div class="form-grid">
    <div class="form-row"><label>القطاع</label><input id="f-sector" value="${d.sector||''}"></div>
    <div class="form-row"><label>المدينة</label>
      <select id="f-city">
        ${['دمشق','ريف دمشق','حلب','حمص','اللاذقية','الرياض','أخرى']
          .map(c=>`<option${d.city===c?' selected':''}>${c}</option>`).join('')}
      </select>
    </div>
  </div>
  <div class="form-grid">
    <div class="form-row"><label>رأس المال</label><input id="f-capital" value="${d.capital||''}"></div>
    <div class="form-row"><label>رقم القيد</label><input id="f-reg" value="${d.reg_number||''}"></div>
  </div>
  <div class="form-grid">
    <div class="form-row"><label>تاريخ التأسيس</label><input id="f-founded" value="${d.founded||''}"></div>
    <div class="form-row"><label>الدولة</label><input id="f-country" value="${d.country||'سوريا'}"></div>
  </div>
  <div class="form-row"><label>ملاحظات</label><textarea id="f-notes">${d.notes||''}</textarea></div>`;
}
async function saveCompanyForm(){
  const body={
    name:document.getElementById('f-name').value.trim(),
    name_en:document.getElementById('f-name-en').value.trim(),
    type:document.getElementById('f-type').value,
    status:document.getElementById('f-status').value,
    sector:document.getElementById('f-sector').value.trim(),
    city:document.getElementById('f-city').value,
    capital:document.getElementById('f-capital').value.trim(),
    reg_number:document.getElementById('f-reg').value.trim(),
    founded:document.getElementById('f-founded').value.trim(),
    country:document.getElementById('f-country').value.trim(),
    notes:document.getElementById('f-notes').value.trim()
  };
  if(!body.name) throw new Error('اسم الشركة مطلوب');
  if(modalId) await api(`/companies/${modalId}`,'PUT',body);
  else await api('/companies','POST',body);
  toast(modalId?'تم التعديل ✅':'تمت الإضافة ✅');
  closeModal(); loadCompanies(); loadDashboard();
}

// --- Relation Form ---
async function renderRelationForm(d={}){
  const [persons, companies] = await Promise.all([
    allPersons.length?Promise.resolve(allPersons):api('/persons'),
    allCompanies.length?Promise.resolve(allCompanies):api('/companies')
  ]);
  allPersons=persons; allCompanies=companies;
  document.getElementById('modal-body').innerHTML=`
  <div class="form-row"><label>الشخص *</label>
    <select id="f-person">
      <option value="">— اختر شخص —</option>
      ${persons.map(p=>`<option value="${p.id}"${d.person_id==p.id?' selected':''}>${p.name}</option>`).join('')}
    </select>
  </div>
  <div class="form-row"><label>الشركة *</label>
    <select id="f-company">
      <option value="">— اختر شركة —</option>
      ${companies.map(c=>`<option value="${c.id}"${d.company_id==c.id?' selected':''}>${c.name}</option>`).join('')}
    </select>
  </div>
  <div class="form-row"><label>الدور *</label>
    <select id="f-role">
      ${['الشريك المؤسس','مؤسس','رئيس مجلس الإدارة','نائب رئيس مجلس الإدارة','عضو مجلس الإدارة','مدير الشركة','المدير العام','مدير','الشريك','أخرى']
        .map(r=>`<option${d.role===r?' selected':''}>${r}</option>`).join('')}
    </select>
  </div>
  <div class="form-grid">
    <div class="form-row"><label>النسبة % </label><input id="f-pct" type="number" step="0.01" min="0" max="100" value="${d.percentage||''}"></div>
    <div class="form-row"><label>الحصص</label><input id="f-shares" value="${d.shares||''}"></div>
  </div>
  <div class="form-row"><label>القيمة (ل.س)</label><input id="f-value" type="number" value="${d.value_ls||''}"></div>
  <div class="form-row"><label>ملاحظات</label><textarea id="f-notes">${d.notes||''}</textarea></div>`;
}
async function saveRelationForm(){
  const body={
    person_id:document.getElementById('f-person')?.value,
    company_id:document.getElementById('f-company')?.value,
    role:document.getElementById('f-role').value,
    percentage:document.getElementById('f-pct').value||null,
    shares:document.getElementById('f-shares').value.trim()||null,
    value_ls:document.getElementById('f-value').value||null,
    notes:document.getElementById('f-notes').value.trim()||null
  };
  if(!body.role) throw new Error('الدور مطلوب');
  if(modalId) await api(`/relations/${modalId}`,'PUT',body);
  else{
    if(!body.person_id||!body.company_id) throw new Error('الشخص والشركة مطلوبان');
    await api('/relations','POST',body);
  }
  toast(modalId?'تم التعديل ✅':'تمت الإضافة ✅');
  closeModal(); loadRelations(); loadDashboard();
}

// --- View Person ---
function renderPersonView(p){
  document.getElementById('modal-body').innerHTML=`
  <div style="margin-bottom:16px">
    <div style="font-size:22px;font-weight:700;color:var(--gold);margin-bottom:4px">${p.name}</div>
    ${p.name_en?`<div style="color:var(--text2);font-size:13px">${p.name_en}</div>`:''}
  </div>
  <div class="form-grid" style="margin-bottom:16px">
    <div><span style="color:var(--text2);font-size:11px">الجنسية</span><div>${p.nationality||'—'}</div></div>
    <div><span style="color:var(--text2);font-size:11px">الإقامة</span><div>${p.residence||'—'}</div></div>
    <div><span style="color:var(--text2);font-size:11px">العائلة</span><div>${p.family||'—'}</div></div>
    <div><span style="color:var(--text2);font-size:11px">المجال</span><div>${p.field||'—'}</div></div>
  </div>
  ${p.notes?`<div style="color:var(--text2);font-size:12px;padding:10px;background:var(--bg);border-radius:8px;margin-bottom:14px">${p.notes}</div>`:''}
  <div class="detail-relations">
    <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--text2)">الشركات المرتبطة (${p.relations?.length||0})</div>
    ${(p.relations||[]).map(r=>`<div class="detail-rel-item">
      <div><div class="detail-rel-name">${r.company_name}</div><div class="detail-rel-role">${r.role}${r.sector?' — '+r.sector:''}</div></div>
      <div class="pct-badge">${r.percentage?r.percentage+'%':r.shares||'—'}</div>
    </div>`).join('')||'<div style="color:var(--text2);font-size:12px">لا توجد علاقات</div>'}
  </div>`;
}

// --- View Company ---
function renderCompanyView(c){
  document.getElementById('modal-body').innerHTML=`
  <div style="margin-bottom:16px">
    <div style="font-size:18px;font-weight:700;color:var(--gold);margin-bottom:4px">${c.name}</div>
    ${c.name_en?`<div style="color:var(--text2);font-size:12px">${c.name_en}</div>`:''}
  </div>
  <div class="form-grid" style="margin-bottom:16px">
    <div><span style="color:var(--text2);font-size:11px">النوع</span><div>${c.type||'—'}</div></div>
    <div><span style="color:var(--text2);font-size:11px">القطاع</span><div>${c.sector||'—'}</div></div>
    <div><span style="color:var(--text2);font-size:11px">المدينة</span><div>${c.city||'—'}</div></div>
    <div><span style="color:var(--text2);font-size:11px">رأس المال</span><div>${c.capital||'—'}</div></div>
    <div><span style="color:var(--text2);font-size:11px">التأسيس</span><div>${c.founded||'—'}</div></div>
    <div><span style="color:var(--text2);font-size:11px">الحالة</span><div>${c.status||'—'}</div></div>
  </div>
  ${c.reg_number?`<div style="color:var(--text2);font-size:11px;margin-bottom:12px">رقم القيد: ${c.reg_number}</div>`:''}
  ${c.notes?`<div style="color:var(--text2);font-size:12px;padding:10px;background:var(--bg);border-radius:8px;margin-bottom:14px">${c.notes}</div>`:''}
  <div class="detail-relations">
    <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--text2)">المساهمون والمديرون (${c.relations?.length||0})</div>
    ${(c.relations||[]).map(r=>`<div class="detail-rel-item">
      <div><div class="detail-rel-name">${r.person_name}</div><div class="detail-rel-role">${r.role}${r.nationality?' — '+r.nationality:''}</div></div>
      <div class="pct-badge">${r.percentage?r.percentage+'%':r.shares||'—'}</div>
    </div>`).join('')||'<div style="color:var(--text2);font-size:12px">لا توجد علاقات</div>'}
  </div>`;
}

// ================================================================
// NETWORK
// ================================================================
const NAT_COLORS={'سوري':'#50C878','لبناني':'#4FC3F7','إماراتي':'#FFB74D','سعودي':'#F48FB1','إيراني':'#CE93D8','أردني':'#80CBC4','فلسطيني':'#FFCC80','عراقي':'#EF9A9A'};
const SECTOR_COLORS={'تجارة':'#3B8BD4','صناعة':'#E24B4A','زراعة':'#8BC34A','عقاري':'#7F77DD','نفط':'#BA7517','تأمين':'#D4537E','صرافة':'#D4537E','تقنية':'#0F6E56','مقاولات':'#E85D24'};

function nodeColor(n){
  if(n.type==='person'){for(const[k,v] of Object.entries(NAT_COLORS))if((n.nat||'').includes(k))return v;return '#50C878';}
  for(const[k,v] of Object.entries(SECTOR_COLORS))if((n.sector||'').includes(k))return v;
  return '#4A90D9';
}
function roleColor(r){
  if(!r) return '#666';
  if(r.includes('مؤسس'))return'#C9A84C';if(r.includes('رئيس'))return'#D4537E';
  if(r.includes('مدير عام')||r.includes('المدير العام'))return'#1D9E75';
  if(r.includes('مدير'))return'#3B8BD4';if(r.includes('عضو'))return'#7F77DD';return'#888';
}
function nodeR(n){return(n.type==='company'?10:7)+Math.min((n.connections||0)*1.3,15);}

async function loadNetwork(){
  try{
    const data=await api('/network');
    drawNetwork(data.nodes, data.links);
  }catch(e){toast('خطأ في تحميل الشبكة','err');}
}

function drawNetwork(nodes, links){
  const wrap=document.getElementById('network-wrap');
  const W=wrap.clientWidth, H=wrap.clientHeight;
  d3.select('#network-svg').selectAll('*').remove();
  netSvg=d3.select('#network-svg');
  netG=netSvg.append('g');
  netZoom=d3.zoom().scaleExtent([0.05,5]).on('zoom',e=>netG.attr('transform',e.transform));
  netSvg.call(netZoom);

  const linksData=links.map(l=>({...l}));
  const nodesData=nodes.map(n=>({...n}));

  netSim=d3.forceSimulation(nodesData)
    .force('link',d3.forceLink(linksData).id(d=>d.id).distance(80).strength(0.3))
    .force('charge',d3.forceManyBody().strength(d=>d.type==='company'?-250:-100))
    .force('center',d3.forceCenter(W/2,H/2))
    .force('collision',d3.forceCollide().radius(d=>nodeR(d)+5));

  const linkSel=netG.append('g').selectAll('line').data(linksData).join('line')
    .attr('stroke',d=>roleColor(d.role)).attr('stroke-width',1.5)
    .attr('stroke-opacity',d=>d.role?.includes('مؤسس')||d.role?.includes('رئيس')?0.85:0.55)
    .attr('stroke-dasharray',d=>d.role?.includes('مدير')&&!d.role?.includes('عام')?'6,3':null);

  const nodeSel=netG.append('g').selectAll('g').data(nodesData).join('g')
    .style('cursor','pointer')
    .call(d3.drag()
      .on('start',(e,d)=>{if(!e.active)netSim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y;})
      .on('drag',(e,d)=>{d.fx=e.x;d.fy=e.y;})
      .on('end',(e,d)=>{if(!e.active)netSim.alphaTarget(0);d.fx=null;d.fy=null;}))
    .on('click',(e,d)=>showNetInfo(d,linksData,nodesData));

  nodeSel.filter(d=>d.connections>=4).append('circle').attr('r',d=>nodeR(d)+5).attr('fill',d=>nodeColor(d)).attr('opacity',0.1);
  nodeSel.append('circle').attr('r',d=>nodeR(d)).attr('fill',d=>nodeColor(d))
    .attr('stroke',d=>d.type==='company'?'rgba(255,255,255,.2)':'rgba(80,200,120,.2)').attr('stroke-width',0.8);
  nodeSel.append('text').attr('x',d=>nodeR(d)+4).attr('y','0.35em')
    .style('font-size',d=>d.connections>=5?'11px':'9px').style('fill',d=>d.connections>=4?'#ccc':'#666')
    .style('font-weight',d=>d.connections>=4?'700':'400').style('font-family','Arial')
    .text(d=>d.label?.length>18?d.label.slice(0,18)+'…':d.label);

  netSim.on('tick',()=>{
    linkSel.attr('x1',d=>d.source.x).attr('y1',d=>d.source.y).attr('x2',d=>d.target.x).attr('y2',d=>d.target.y);
    nodeSel.attr('transform',d=>`translate(${d.x},${d.y})`);
  });

  // Store refs for filters
  netSvg._nodeSel=nodeSel; netSvg._linkSel=linkSel;
}

function showNetInfo(d, links, nodes){
  const nodeMap={}; nodes.forEach(n=>nodeMap[n.id]=n);
  const myLinks=links.filter(l=>(typeof l.source==='object'?l.source.id:l.source)===d.id||(typeof l.target==='object'?l.target.id:l.target)===d.id);
  document.getElementById('ni-title').textContent=d.label;
  document.getElementById('ni-body').innerHTML=`
    <div class="ni-row"><span class="ni-label">${d.type==='person'?'الجنسية':'القطاع'}</span><span class="ni-val">${d.type==='person'?(d.nat||'—'):(d.sector||'—')}</span></div>
    <div class="ni-row"><span class="ni-label">العلاقات</span><span class="ni-val" style="color:var(--gold);font-weight:700">${d.connections}</span></div>
    <div class="ni-rels">${myLinks.slice(0,5).map(l=>{
      const other=nodeMap[typeof l.source==='object'?l.source.id:l.source]?.id===d.id?nodeMap[typeof l.target==='object'?l.target.id:l.target]:nodeMap[typeof l.source==='object'?l.source.id:l.source];
      return `<div class="ni-rel-item">→ ${other?.label||'—'} <small>(${l.role||''})</small></div>`;
    }).join('')}</div>`;
  document.getElementById('net-info').style.display='block';
}

function searchNetwork(v){
  if(!netSvg?._nodeSel) return;
  if(!v){netSvg._nodeSel.style('opacity',1);netSvg._linkSel.style('opacity',null);return;}
  netSvg._nodeSel.style('opacity',d=>d.label?.includes(v)?1:0.1);
}
function netZoomIn(){netSvg.transition().call(netZoom.scaleBy,1.4);}
function netZoomOut(){netSvg.transition().call(netZoom.scaleBy,0.7);}
function netReset(){netSvg.transition().call(netZoom.transform,d3.zoomIdentity);}
function netToggleLabels(){netShowLabels=!netShowLabels;netG.selectAll('text').style('display',netShowLabels?'block':'none');}
function netFilter(type){
  if(!netSvg?._nodeSel) return;
  if(type==='all'){netSvg._nodeSel.style('opacity',1);netSvg._linkSel.style('opacity',null);}
  else if(type==='top'){netSvg._nodeSel.style('opacity',d=>d.connections>=5?1:0.1);}
}

// ================================================================
// INIT
// ================================================================
window.addEventListener('load',()=>{
  loadDashboard();
});
