"use strict";
const brNum = (n,dec=6) => Number(n).toLocaleString('pt-BR',{maximumFractionDigits:dec});
const brMoney = n => Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const eps = 1e-9;
function readNumber(form,name){
 const input=form.elements.namedItem(name);
 if(!input || !String(input.value).trim()) throw Error('Preencha todos os campos numéricos.');
 const n=Number(input.value);
 if(!Number.isFinite(n)) throw Error('Informe apenas números válidos.');
 return n;
}
function mustSafe(n){if(!Number.isFinite(n)) throw Error('O resultado excedeu o limite de cálculo. Tente valores menores.');return n;}
function unitResult(value,suffix){return brNum(mustSafe(value),8)+' '+suffix;}
function randomIndex(max){
 if(!Number.isSafeInteger(max)||max<1||max>0xffffffff) throw Error('Intervalo de sorteio inválido.');
 const limit=Math.floor(0x100000000/max)*max;
 const buf=new Uint32Array(1);
 let number;
 do {crypto.getRandomValues(buf);number=buf[0];} while(number>=limit);
 return number%max;
}
function runCalc(slug,form){
 switch(slug){
  case 'porcentagem':{
   const v=readNumber(form,'valor'),p=readNumber(form,'percentual'),r=mustSafe(v*p/100);
   return {value:brNum(r),detail:`${brNum(p)}% de ${brNum(v)} = ${brNum(r)}`};
  }
  case 'variacao-percentual':{
   const a=readNumber(form,'inicial'),b=readNumber(form,'final');
   if(a===0) throw Error('Não é possível calcular a variação percentual quando o valor inicial é zero.');
   const n=mustSafe(((b-a)/Math.abs(a))*100);
   return {value:`${brNum(Math.abs(n))}%`,detail:n>0?'Aumento percentual':n<0?'Redução percentual':'Sem variação'};
  }
  case 'juros-simples':case 'juros-compostos':{
   const c=readNumber(form,'capital'),i=readNumber(form,'taxa'),n=readNumber(form,'periodos');
   if(c<0||n<0||!Number.isInteger(n)||n>1200) throw Error('Informe capital não negativo e meses inteiros de 0 a 1200.');
   if(slug==='juros-compostos'&&i< -100) throw Error('A taxa composta não pode ser inferior a -100%.');
   const total=mustSafe(slug==='juros-simples'?c*(1+i/100*n):c*Math.pow(1+i/100,n));
   return {value:brMoney(total),detail:`Juros: ${brMoney(mustSafe(total-c))}. Total após ${n} ${n===1?'mês':'meses'}.`};
  }
  case 'regra-de-tres':{
   const a=readNumber(form,'a'),b=readNumber(form,'b'),c=readNumber(form,'c');
   if(a===0) throw Error('O valor A não pode ser zero.');
   return {value:`X = ${brNum(mustSafe(b*c/a),8)}`,detail:'Resultado para grandezas diretamente proporcionais.'};
  }
  case 'media-aritmetica':{
   const input=form.elements.namedItem('numeros').value.trim();
   const parts=input.split(/[;\n]+/).map(s=>s.trim()).filter(Boolean);
   if(!parts.length) throw Error('Digite pelo menos um número.');
   if(parts.length>1000) throw Error('Informe até 1000 números por vez.');
   const nums=parts.map(x=>Number(x.replace(',','.')));
   if(nums.some(x=>!Number.isFinite(x))) throw Error('Use ponto e vírgula para separar valores. Exemplo: 7; 8,5; 9.');
   const sum=mustSafe(nums.reduce((sum,n)=>sum+n,0));
   return {value:brNum(sum/nums.length,8),detail:`Soma: ${brNum(sum)} · ${nums.length} ${nums.length===1?'número':'números'}`};
  }
  case 'idade':{
   const raw=form.elements.namedItem('nascimento').value;
   if(!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw Error('Informe uma data de nascimento válida.');
   const [y,m,d]=raw.split('-').map(Number);
   const check=new Date(y,m-1,d);
   if(check.getFullYear()!==y||check.getMonth()!==m-1||check.getDate()!==d) throw Error('A data de nascimento é inválida.');
   const now=new Date();let age=now.getFullYear()-y;
   if(now.getMonth()+1<m||(now.getMonth()+1===m&&now.getDate()<d)) age--;
   if(age<0) throw Error('A data de nascimento não pode estar no futuro.');
   if(age>130) throw Error('Confira a data de nascimento informada.');
   return {value:`${age} ${age===1?'ano':'anos'}`,detail:'Idade em anos completos, considerando a data de hoje.'};
  }
  case 'comprimento':case 'massa':{
   const v=readNumber(form,'valor');const from=form.elements.namedItem('origem').value,to=form.elements.namedItem('destino').value;
   const factors=slug==='comprimento'?{mm:.001,cm:.01,m:1,km:1000}:{mg:.001,g:1,kg:1000,t:1000000};
   const n=mustSafe(v*factors[from]/factors[to]);
   return {value:unitResult(n,to),detail:`${brNum(v)} ${from} = ${brNum(n,8)} ${to}`};
  }
  case 'temperatura':{
   const v=readNumber(form,'valor'),from=form.elements.namedItem('origem').value,to=form.elements.namedItem('destino').value;
   const c=from==='c'?v:from==='f'?(v-32)*5/9:v-273.15;
   if(c < -273.1500001) throw Error('Não existe temperatura física abaixo do zero absoluto (0 K).');
   const result=mustSafe(to==='c'?c:to==='f'?c*9/5+32:c+273.15);
   const symbol={c:'°C',f:'°F',k:'K'};
   return {value:unitResult(Math.abs(result)<eps?0:result,symbol[to]),detail:`${brNum(v)} ${symbol[from]} = ${brNum(result,8)} ${symbol[to]}`};
  }
  case 'sorteador':{
   const min=readNumber(form,'minimo'),max=readNumber(form,'maximo'),count=readNumber(form,'quantidade');
   if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||!Number.isInteger(count)) throw Error('Use apenas números inteiros.');
   if(max<min) throw Error('O valor máximo deve ser maior ou igual ao mínimo.');
   const range=max-min+1;
   if(range>10000000) throw Error('Use um intervalo de até 10 milhões de números.');
   if(count<1||count>100) throw Error('A quantidade deve estar entre 1 e 100.');
   const unique=form.elements.namedItem('unicos').checked;
   if(unique&&count>range) throw Error('Não há números suficientes no intervalo para um sorteio sem repetição.');
   const out=[];const seen=new Set();
   while(out.length<count){const value=min+randomIndex(range);if(!unique||!seen.has(value)){seen.add(value);out.push(value);}}
   return {value:out.map(x=>brNum(x,0)).join(' · '),detail:unique?'Sorteio sem repetição.':'Sorteio com possibilidade de repetição.'};
  }
  case 'gerador-de-senhas':{
   const length=readNumber(form,'tamanho');
   if(!Number.isInteger(length)||length<8||length>64) throw Error('Escolha de 8 a 64 caracteres.');
   const groups=[['minusculas','abcdefghijkmnopqrstuvwxyz'],['maiusculas','ABCDEFGHJKLMNPQRSTUVWXYZ'],['numeros','23456789'],['simbolos','!@#$%&*_-+?']].filter(([name])=>form.elements.namedItem(name).checked).map(([name,chars])=>chars);
   if(!groups.length) throw Error('Marque pelo menos um tipo de caractere.');
   const all=groups.join('');
   const result=groups.map(chars=>chars[randomIndex(chars.length)]);
   while(result.length<length) result.push(all[randomIndex(all.length)]);
   for(let i=result.length-1;i>0;i--){const j=randomIndex(i+1);[result[i],result[j]]=[result[j],result[i]];}
   return {value:result.join(''),detail:'Senha gerada localmente. Copie-a e armazene em um gerenciador confiável.'};
  }
 }
 throw Error('Ferramenta não encontrada.');
}
const calcForm=document.querySelector('[data-tool-form]');
if(calcForm){
 const result=document.getElementById('resultado');const detail=document.getElementById('resultado-detalhe');
 calcForm.addEventListener('submit',e=>{
  e.preventDefault();
  try {const r=runCalc(calcForm.dataset.toolForm,calcForm);result.textContent=r.value;detail.textContent=r.detail;result.parentElement.classList.remove('error');}
  catch(err){result.textContent=err.message||'Erro no cálculo.';detail.textContent='Revise os campos e tente novamente.';result.parentElement.classList.add('error');}
 });
}
const search=document.getElementById('tool-search');
if(search){
 const cards=[...document.querySelectorAll('[data-card]')];
 const chips=[...document.querySelectorAll('[data-filter]')];
 const empty=document.getElementById('no-results');
 let category='Todas';
 const normal=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 function filter(){let visible=0;const q=normal(search.value.trim());
  for(const card of cards){const match=(category==='Todas'||card.dataset.category===category)&&normal(card.textContent).includes(q);card.hidden=!match;if(match)visible++;}
  empty.style.display=visible?'none':'block';
 }
 search.addEventListener('input',filter);
 for(const chip of chips) chip.addEventListener('click',()=>{category=chip.dataset.filter;chips.forEach(c=>{const active=c===chip;c.classList.toggle('active',active);c.setAttribute('aria-pressed',String(active));});filter();});
 filter();
}
