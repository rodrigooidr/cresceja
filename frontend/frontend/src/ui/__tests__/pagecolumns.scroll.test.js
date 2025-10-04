import { render, screen } from '@testing-library/react';
import { PageColumns } from '../../ui/layout/PageColumns';

test('PageColumns cria colunas com overflow independente', () => {
  render(
    <div style={{height:'500px'}}>
      <PageColumns cols="200px 1fr 200px">
        <div data-testid="c1">A</div>
        <div data-testid="c2">B</div>
        <div data-testid="c3">C</div>
      </PageColumns>
    </div>
  );
  ['c1','c2','c3'].forEach(id=>{
    const el = screen.getByTestId(id);
    expect(el.style.overflowY).toBe('auto');
  });
});
