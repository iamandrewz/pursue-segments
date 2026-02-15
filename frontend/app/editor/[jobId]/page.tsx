import TranscriptEditor from '@/components/TranscriptEditor';

interface EditorPageProps {
  params: Promise<{ jobId: string }>;
}

export function generateStaticParams() {
  // Return empty array to indicate dynamic rendering at runtime
  // For static export, we'll use client-side routing
  return [];
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { jobId } = await params;
  
  return <TranscriptEditor jobId={jobId} />;
}
