export function ukClock(now=new Date()){const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now).reduce((parts,item)=>({...parts,[item.type]:item.value}),{} as Record<string,string>);return {day:`${p.year}-${p.month}-${p.day}`,minutes:Number(p.hour)*60+Number(p.minute)};}
export function collectionChoices(date:string,windows:readonly string[],selected:string,now=new Date()){
 const clock=ukClock(now);if(!date)return [];
 if(date>clock.day){const values=selected&&!windows.includes(selected)?[selected,...windows]:windows;return values.map(window=>({window,date,label:window}));}
 const first=Math.ceil((clock.minutes+120)/60)*60;
 const format=(minutes:number)=>`${String(Math.floor(minutes/60)%24).padStart(2,"0")}:${String(minutes%60).padStart(2,"0")}`;
 return Array.from({length:12},(_,i)=>{const start=first+i*120,dayOffset=Math.floor(start/1440),day=new Date(clock.day+"T12:00:00Z");day.setUTCDate(day.getUTCDate()+dayOffset);const next=day.toISOString().slice(0,10),window=`${format(start)}-${format(start+120)}`;return {window,date:next,label:dayOffset?`${window} · ${next} (${dayOffset===1?"next day":dayOffset+" days later"})`:window};});
}
