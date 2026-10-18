import { PublicAccess } from '../../features/access/public-access';
export const metadata = {
  title: 'Request workspace access',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};
export default function RegisterPage() {
  return <PublicAccess />;
}
