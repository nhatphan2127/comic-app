import ConsoleApp from '../console/ConsoleApp';
import { adminConsole } from '../features/admin/modules';

export default function Admin() {
  return <ConsoleApp config={adminConsole} />;
}
