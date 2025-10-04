import React from 'react';
import clsx from 'clsx';

export function PageColumns({ cols="320px 1fr 360px", className="", children }) {
  return (
    <div className={clsx("h-full grid overflow-hidden", className)} style={{gridTemplateColumns: cols}}>
      {React.Children.map(children, (child, i) =>
        React.isValidElement(child)
          ? React.cloneElement(child, {
              className: clsx(
                "overflow-y-auto",
                i === 0 && "border-r",
                i === 2 && "border-l",
                child.props.className
              ),
              style: { ...(child.props.style || {}), overflowY: 'auto' },
            })
          : child
      )}
    </div>
  );
}
