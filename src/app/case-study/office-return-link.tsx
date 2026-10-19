'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { workspaceRoute } from '@/lib/routes';

interface OfficeReturnLinkProps {
  className?: string;
  children: ReactNode;
}
const ContextOfficeLink = (props: OfficeReturnLinkProps) => {
  const params = useSearchParams();
  return (
    <Link href={workspaceRoute('office', params.get('workspace'), params.get('mode'))} {...props} />
  );
};

export const OfficeReturnLink = (props: OfficeReturnLinkProps) => (
  <Suspense
    fallback={
      <span className={props.className} aria-busy="true">
        {props.children}
      </span>
    }
  >
    <ContextOfficeLink {...props} />
  </Suspense>
);
