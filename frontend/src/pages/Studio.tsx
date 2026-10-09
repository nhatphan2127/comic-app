import ConsoleApp from '../console/ConsoleApp';
import { studioConsole } from '../features/studio/modules';

export default function Studio() {
  return <ConsoleApp config={studioConsole} />;
}
