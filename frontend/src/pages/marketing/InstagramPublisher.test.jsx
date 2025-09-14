import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InstagramPublisher from './InstagramPublisher.jsx';
import inboxApi from '../../api/inboxApi.js';
import { OrgContext } from '../../contexts/OrgContext.jsx';
import axios from 'axios';

jest.mock('../../api/inboxApi.js');

function renderWithOrg(ui){
  return render(
    <OrgContext.Provider value={{ selected: 'org1' }}>
      {ui}
    </OrgContext.Provider>
  );
}

test('uploads with progress and publishes', async () => {
  inboxApi.get.mockResolvedValueOnce({ data: [{ id: 'acc1', username: 'u' }] });
  inboxApi.post
    .mockResolvedValueOnce({ data: { url: 'https://s3/upload', objectUrl: 'https://s3/file.jpg' } })
    .mockResolvedValueOnce({});
  jest.spyOn(axios, 'put').mockImplementation((_url,_file,config)=>{
    config.onUploadProgress({ loaded:5, total:10 });
    config.onUploadProgress({ loaded:10, total:10 });
    return Promise.resolve({});
  });

  renderWithOrg(<InstagramPublisher />);
  await screen.findByText('Instagram Publisher');

  const file = new File(['hello'], 'f.jpg', { type: 'image/jpeg' });
  fireEvent.change(screen.getByTestId('file-input'), { target: { files: [file] } });
  await screen.findByText('Progresso: 100%');

  fireEvent.click(screen.getByText('Publicar agora'));
  await waitFor(()=>{
    expect(inboxApi.post).toHaveBeenLastCalledWith(
      '/orgs/org1/instagram/accounts/acc1/publish',
      expect.objectContaining({ media: { url: 'https://s3/file.jpg' } })
    );
  });
});
