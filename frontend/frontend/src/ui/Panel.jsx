export default function Panel({title, actions=null, children, className=""}){
  return (
    <section className={"ui-card "+className}>
      {(title || actions) && (
        <header className="px-3 py-2 border-b flex items-center justify-between">
          <h3 className="font-medium">{title}</h3>
          <div>{actions}</div>
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}
