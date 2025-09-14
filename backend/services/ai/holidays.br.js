const FIXED_HOLIDAYS = [
  '-01-01', // Confraternização Universal
  '-04-21', // Tiradentes
  '-05-01', // Dia do Trabalhador
  '-09-07', // Independência do Brasil
  '-10-12', // Nossa Senhora Aparecida
  '-11-02', // Finados
  '-11-15', // Proclamação da República
  '-12-25'  // Natal
];

export function getBrazilHolidays(year){
  return FIXED_HOLIDAYS.map(d => `${year}${d}`);
}
