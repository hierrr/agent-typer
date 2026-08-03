import { registerTheme } from '../theme-api';
import { TerminalTheme } from './TerminalTheme';

registerTheme({
  id: 'terminal',
  label: 'Terminal',
  documentTitle: '~/work — agent run',
  status: 'ready',
  Component: TerminalTheme,
});
