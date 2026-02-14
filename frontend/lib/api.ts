const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export async function saveQuestionnaire(data: {
  podcastName: string;
  hostNames: string;
  answers: Record<string, string>;
}) {
  const response = await fetch(`${API_URL}/api/questionnaire`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save questionnaire');
  }

  return response.json();
}

export async function getQuestionnaire(id: string) {
  const response = await fetch(`${API_URL}/api/questionnaire/${id}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch questionnaire');
  }

  return response.json();
}

export async function generateProfile(questionnaireId: string) {
  const response = await fetch(`${API_URL}/api/generate-profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ questionnaireId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate profile');
  }

  return response.json();
}

export async function getProfile(id: string) {
  const response = await fetch(`${API_URL}/api/profile/${id}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch profile');
  }

  return response.json();
}

export async function checkHealth() {
  const response = await fetch(`${API_URL}/api/health`);
  return response.json();
}
