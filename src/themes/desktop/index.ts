import { registerTheme } from '../theme-api';
import { DesktopTheme } from './DesktopTheme';

registerTheme({
  id: 'desktop',
  label: 'Desktop',
  documentTitle: 'Cowork — Sprint Board',
  status: 'ready',
  Component: DesktopTheme,
});
