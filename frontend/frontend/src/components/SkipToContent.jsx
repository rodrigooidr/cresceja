
import React from 'react';
export default function SkipToContent(){
  return (
    <a href="#content" style={{position:'absolute',left:-9999,top:-9999}} onFocus={(e)=>{e.target.style.left='8px'; e.target.style.top='8px';}} onBlur={(e)=>{e.target.style.left='-9999px'; e.target.style.top='-9999px';}}>Pular para o conteúdo</a>
  );
}
