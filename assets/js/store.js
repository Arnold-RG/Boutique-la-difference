(function(){
'use strict';
var $=function(s,r){return(r||document).querySelector(s)};
var $$=function(s,r){return Array.from((r||document).querySelectorAll(s))};
var images={
food:'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=600&q=75',
drinks:'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=600&q=75',
home:'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=600&q=75',
body:'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=600&q=75',
electronics:'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=600&q=75',
tools:'https://images.unsplash.com/photo-1581147036324-c1c9b3b8c8e9?auto=format&fit=crop&w=600&q=75',
more:'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=75'};
var categories={food:'Food & pantry',drinks:'Drinks',home:'Home essentials',body:'Personal care',electronics:'Electronics',tools:'Tools',more:'More'};
var s={products:[],category:'all',query:'',cart:[],previousFocus:null};
var cartKey='bld-cart-v1';
function node(tag,cls,value){var e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=String(value);return e}
function cash(v){return 'RWF '+Math.round(Number(v)||0).toLocaleString('en-US')}
function sanitizeProducts(rows){return(Array.isArray(rows)?rows:[]).filter(function(p){return p&&p.id&&p.name&&p.active!==false}).map(function(p){return{id:String(p.id),name:String(p.name),category:String(p.category||'more'),price:Math.max(0,Number(p.price)||0),description:String(p.description||'').slice(0,160),unit:String(p.unit||'item'),image:/^https:\/\/images\.unsplash\.com\/photo-[\w-]+/.test(p.image||'')?p.image:''}})}
async function loadProducts(){try{
 if(window.BLD&&typeof BLD.ensureSeedCatalog==='function'){await BLD.ensureSeedCatalog();s.products=sanitizeProducts(BLD.get().products)}
 if(!s.products.length){var res=await fetch('data/products.json',{cache:'no-cache'});if(!res.ok)throw new Error('Catalogue unavailable');var json=await res.json();s.products=sanitizeProducts(json.products)}
 renderProducts()
 }catch(err){$('#products').replaceChildren(node('p','no-results','The catalogue is unavailable right now. Please check back or visit the store.'));$('#resultCount').textContent='Catalogue unavailable'}}
function items(){return s.products.filter(function(p){return(s.category==='all'||p.category===s.category)&&(p.name+' '+p.description+' '+p.category).toLowerCase().includes(s.query)})}
function renderProducts(){var f=document.createDocumentFragment();var list=items();
list.forEach(function(p){var article=node('article','product-card'),photo=node('div','product-photo'),img=node('img');
img.src=p.image||images[p.category]||images.more;img.alt='Illustrative category photo for '+(categories[p.category]||'shop essentials');img.loading='lazy';img.decoding='async';img.addEventListener('error',function(){img.style.display='none'});
photo.append(img,node('span','product-badge','Everyday essential'));
var detail=node('div','product-detail');detail.append(node('span','category-label',categories[p.category]||'Other'),node('h3','',p.name),node('p','',p.description||'Ask about this item.'));
var bottom=node('div','product-bottom');bottom.append(node('strong','',cash(p.price)));var btn=node('button','add-product','+');btn.type='button';btn.setAttribute('aria-label','Add '+p.name+' to shopping list');btn.addEventListener('click',function(){add(p);btn.textContent='✓';window.setTimeout(function(){btn.textContent='+'},700)});bottom.append(btn);detail.append(bottom);article.append(photo,detail);f.append(article)});
if(!list.length)f.append(node('p','no-results','No products match. Try another department or search term.'));
$('#products').replaceChildren(f);$('#resultCount').textContent=list.length+' product'+(list.length===1?'':'s')+' shown'}
function filter(category){s.category=category;$$('#filters button').forEach(function(btn){var active=btn.dataset.filter===category;btn.classList.toggle('selected',active);btn.setAttribute('aria-pressed',String(active))});renderProducts()}
function localCart(){try{var c=JSON.parse(localStorage.getItem(cartKey)||'[]');return Array.isArray(c)?c:[]}catch(e){return[]}}
async function loadCart(){if(window.BLD&&BLD.loadCart){try{s.cart=await BLD.loadCart()}catch(e){s.cart=localCart()}}else s.cart=localCart();renderCart()}
async function saveCart(){try{localStorage.setItem(cartKey,JSON.stringify(s.cart))}catch(e){}if(window.BLD&&BLD.saveCart){try{await BLD.saveCart(s.cart)}catch(e){}}renderCart()}
function add(p){var x=s.cart.find(function(y){return y.id===p.id});if(x)x.qty=Math.min(99,Number(x.qty||1)+1);else s.cart.push({id:p.id,name:p.name,price:p.price,unit:p.unit,qty:1});saveCart()}
function quantity(id,delta){var x=s.cart.find(function(y){return y.id===id});if(!x)return;x.qty=Math.min(99,Number(x.qty||0)+delta);if(x.qty<=0)s.cart=s.cart.filter(function(y){return y.id!==id});saveCart()}
function renderCart(){var count=s.cart.reduce(function(n,p){return n+Number(p.qty||0)},0),total=s.cart.reduce(function(n,p){return n+Number(p.price||0)*Number(p.qty||0)},0);
$('#cartCount').textContent=count;$('#cartOpen').setAttribute('aria-label','Open shopping list, '+count+' items');$('#cartTotal').textContent=cash(total);
var fragment=document.createDocumentFragment();if(!s.cart.length)fragment.append(node('p','cart-empty','Your basket is empty. Add a few everyday essentials.'));
s.cart.forEach(function(p){var row=node('div','cart-row'),info=node('div');info.append(node('strong','',p.name),node('small','',cash(p.price)+' / '+p.unit));var adjust=node('div','qty'),minus=node('button','','−'),plus=node('button','','+');minus.type='button';plus.type='button';minus.setAttribute('aria-label','Remove one '+p.name);plus.setAttribute('aria-label','Add one '+p.name);minus.addEventListener('click',function(){quantity(p.id,-1)});plus.addEventListener('click',function(){quantity(p.id,1)});adjust.append(minus,node('span','',p.qty),plus);row.append(info,adjust);fragment.append(row)});$('#cartItems').replaceChildren(fragment);
$('#copyList').disabled=!s.cart.length;$('#clearCart').disabled=!s.cart.length}
function openDrawer(){s.previousFocus=document.activeElement;$('#backdrop').hidden=false;$('#drawer').classList.add('open');$('#drawer').setAttribute('aria-hidden','false');document.body.classList.add('lock');$('#cartClose').focus()}
function closeDrawer(){$('#drawer').classList.remove('open');$('#drawer').setAttribute('aria-hidden','true');$('#backdrop').hidden=true;document.body.classList.remove('lock');if(s.previousFocus&&s.previousFocus.focus)s.previousFocus.focus()}
function textList(){var lines=['Boutique La Différence — shopping enquiry','Zindiro, Kigali, Rwanda',''];s.cart.forEach(function(p){lines.push('- '+p.name+' x'+p.qty+' — '+cash(p.price*p.qty))});lines.push('','Estimated total: '+$('#cartTotal').textContent,'Prices and stock subject to shop confirmation.','This is not a paid order.');return lines.join('\n')}
async function copyList(){if(!s.cart.length)return;var text=textList();try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(text);else{var area=node('textarea');area.value=text;document.body.append(area);area.select();var ok=document.execCommand('copy');area.remove();if(!ok)throw new Error('Copy failed')}$('#copyStatus').textContent='List copied. Share it with the shop or bring it in person.'}catch(e){$('#copyStatus').textContent='Copy unavailable. You can still review the basket here.'}}
function init(){
$('#year').textContent=new Date().getFullYear();$('#cartOpen').addEventListener('click',openDrawer);$('#cartClose').addEventListener('click',closeDrawer);$('#backdrop').addEventListener('click',closeDrawer);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&$('#drawer').classList.contains('open'))closeDrawer()});
$('#drawer').addEventListener('keydown',function(e){if(e.key!=='Tab')return;var b=Array.from(this.querySelectorAll('button:not(:disabled)'));if(!b.length)return;if(e.shiftKey&&document.activeElement===b[0]){e.preventDefault();b[b.length-1].focus()}else if(!e.shiftKey&&document.activeElement===b[b.length-1]){e.preventDefault();b[0].focus()}});
$('#copyList').addEventListener('click',copyList);$('#clearCart').addEventListener('click',function(){s.cart=[];saveCart();$('#copyStatus').textContent=''});
$('#searchInput').addEventListener('input',function(e){s.query=e.target.value.trim().toLowerCase();renderProducts()});
$$('#filters button').forEach(function(b){b.addEventListener('click',function(){filter(b.dataset.filter)})});
$$('#departmentGrid button').forEach(function(b){b.addEventListener('click',function(){filter(b.dataset.category);$('#shop').scrollIntoView({behavior:'smooth',block:'start'})})});
var m=$('#menuToggle'),nav=$('#navigation');m.addEventListener('click',function(){var expanded=nav.classList.toggle('open');m.setAttribute('aria-expanded',String(expanded))});$$('#navigation a').forEach(function(a){a.addEventListener('click',function(){nav.classList.remove('open');m.setAttribute('aria-expanded','false')})});
window.addEventListener('storage',function(e){if(e.key===cartKey)loadCart()});window.addEventListener('bld:store',function(){if(window.BLD){s.products=sanitizeProducts(BLD.get().products);renderProducts()}});
loadCart();loadProducts()
}
document.addEventListener('DOMContentLoaded',init)
})();