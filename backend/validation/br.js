export function onlyDigits(str = "") {
  return (str || "").toString().replace(/\D+/g, "");
}

export function isValidCPF(value = "") {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^([0-9])\1+$/.test(cpf)) return false;
  const calc = (factor) => {
    let total = 0;
    for (let i = 0; i < factor - 1; i++) {
      total += parseInt(cpf[i]) * (factor - i);
    }
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(10) === parseInt(cpf[9]) && calc(11) === parseInt(cpf[10]);
}

export function isValidCNPJ(value = "") {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^([0-9])\1+$/.test(cnpj)) return false;
  const calc = (base) => {
    const factors = base === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    let total = 0;
    for (let i = 0; i < factors.length; i++) {
      total += parseInt(cnpj[i]) * factors[i];
    }
    const rest = total % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === parseInt(cnpj[12]) && calc(13) === parseInt(cnpj[13]);
}

export function isValidCEP(value = "") {
  const cep = onlyDigits(value);
  return cep.length === 8;
}

export function isValidUF(value = "") {
  return [
    "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
  ].includes((value || "").toUpperCase());
}

export function isValidBRPhone(value = "") {
  return /^\+55\d{10,11}$/.test(value);
}
