import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InstagramPublisher from '../src/pages/marketing/InstagramPublisher.jsx';
import inboxApi from '../src/api/inboxApi.js';
import axios from 'axios';
import { OrgContext } from '../src/contexts/OrgContext.jsx';

jest.mock('../src/api/inboxApi.js');

function renderWithOrg(ui){
  return render(<OrgContext.Provider value={{ selected: 'org1' }}>{ui}</OrgContext.Provider>);
}

test('video publish shows progress steps', async () => {
  inboxApi.get
    .mockResolvedValueOnce({ data: [{ id:'acc1', username:'u' }] })
    .mockResolvedValueOnce({ data: [] })
    .mockResolvedValueOnce({ data: { status:'creating', creation_id:null } })
    .mockResolvedValueOnce({ data: { status:'creating', creation_id:'c1' } })
    .mockResolvedValueOnce({ data: { status:'publishing' } })
    .mockResolvedValueOnce({ data: { status:'done' } })
    .mockResolvedValueOnce({ data: [] });
  inboxApi.post
    .mockResolvedValueOnce({ data: { url:'u', objectUrl:'http://v.mp4' } })
    .mockResolvedValueOnce({ data: { job_id:'j1' } });
  jest.spyOn(axios,'put').mockImplementation((_u,_f,conf)=>{ conf.onUploadProgress({loaded:1,total:1}); return Promise.resolve({}); });

  renderWithOrg(<InstagramPublisher />);
  await screen.findByText('Instagram Publisher');
  fireEvent.change(screen.getByDisplayValue('Imagem'), { target:{ value:'video' } });
  const file = new File(['vid'],'v.mp4',{ type:'video/mp4' });
  fireEvent.change(screen.getByTestId('file-input'), { target:{ files:[file] } });
  await waitFor(()=>expect(inboxApi.post).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByText('Publicar agora'));
  await screen.findByText('Criando container');
  await screen.findByText('Processando vídeo...');
  await screen.findByText('Publicando...');
  await waitFor(()=>screen.getByText('Concluído'));
});
