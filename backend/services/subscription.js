
export function addDays(d, days){
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
