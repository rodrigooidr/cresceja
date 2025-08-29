export const Input  = (p) => <input  {...p} className={"ui-input "+(p.className||"")} />;
export const Select = (p) => <select {...p} className={"ui-input "+(p.className||"")} />;
export const Button = ({variant="default", className="", ...rest}) =>
  <button {...rest} className={"ui-btn "+(variant==="primary"?"ui-btn--primary ":"")+className} />;
