import React from "react";

function classNames(...parts) {
  return parts.filter(Boolean).join(" ");
}

const Switch = React.forwardRef(function Switch(
  { id, checked = false, disabled = false, className = "", onChange, ...rest },
  ref,
) {
  return (
    <input
      {...rest}
      ref={ref}
      id={id}
      type="checkbox"
      role="switch"
      className={classNames("ui-switch", className)}
      checked={!!checked}
      disabled={disabled}
      onChange={(event) => {
        if (typeof onChange === "function") {
          onChange(event.target.checked, event);
        }
      }}
    />
  );
});

export default Switch;
