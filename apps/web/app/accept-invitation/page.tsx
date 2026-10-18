import { PublicAccess } from '../../features/access/public-access';
export const metadata = {
  title: 'Accept invitation',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};
export default function InvitationPage() {
  return <PublicAccess invitation />;
}
