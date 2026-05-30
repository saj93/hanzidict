import { Suspense } from 'react';
import ChengyuClient from './ChengyuClient';

export default function ChengyuPage() {
  return (
    <Suspense>
      <ChengyuClient />
    </Suspense>
  );
}
