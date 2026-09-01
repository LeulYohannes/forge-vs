'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function CompanyDashboard() {
  const supabase = createClientComponentClient();
  const [company, setCompany] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [bugDesc, setBugDesc] = useState('');
  const [refCode, setRefCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'tickets' | 'results'>('tickets');

  useEffect(() => {
    loadCompanyData();
  }, []);

  async function loadCompanyData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from('company_users')
      .select('company_id, companies(*)')
      .eq('user_id', user.id)
      .single();

    if (membership) {
      setCompany(membership.companies);
      fetchTickets(membership.company_id);
      fetchSubmissions(membership.company_id);
    }
  }

  async function fetchTickets(companyId: string) {
    const { data } = await supabase
      .from('company_tickets')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (data) setTickets(data);
  }

  async function fetchSubmissions(companyId: string) {
    const { data } = await supabase
      .from('submissions')
      .select('*, assignments(token, candidate_email, company_tickets(function_signature))')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (data) setSubmissions(data);
  }

  async function handleUploadTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    setIsGenerating(true);

    const { data: { session } } = await supabase.auth.getSession();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://forge-ai-core.onrender.com';

    try {
      const res = await fetch(`${apiUrl}/companies/${company.id}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ bug_description: bugDesc, reference_fix_code: refCode })
      });
      if (res.ok) {
        setBugDesc('');
        setRefCode('');
        fetchTickets(company.id);
      }
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleApprove(ticketId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://forge-ai-core.onrender.com';
    await fetch(`${apiUrl}/companies/${company.id}/tickets/${ticketId}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session?.access_token}` }
    });
    fetchTickets(company.id);
  }

  async function handleAssign(ticketId: string) {
    const email = prompt("Enter candidate email (optional):");
    const { data: { session } } = await supabase.auth.getSession();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://forge-ai-core.onrender.com';

    const res = await fetch(`${apiUrl}/companies/${company.id}/tickets/${ticketId}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({ candidate_email: email || undefined })
    });
    const data = await res.json();
    alert(`Assignment created! Send this code to the candidate:\n\n${data.token}`);
  }

  return (
    <div style={{ padding: '32px', fontFamily: 'system-ui, sans-serif', maxWidth: 1200, margin: '0 auto' }}>
      <h1>{company ? company.name : 'Company'} Dashboard</h1>
      <div style={{ display: 'flex', gap: '12px', margin: '20px 0' }}>
        <button onClick={() => setActiveTab('tickets')} style={{ padding: '8px 16px', fontWeight: activeTab === 'tickets' ? 'bold' : 'normal' }}>
          Tickets & Generation
        </button>
        <button onClick={() => setActiveTab('results')} style={{ padding: '8px 16px', fontWeight: activeTab === 'results' ? 'bold' : 'normal' }}>
          Candidate Results & Telemetry
        </button>
      </div>

      {activeTab === 'tickets' ? (
        <div>
          <form onSubmit={handleUploadTicket} style={{ background: '#f5f5f5', padding: '20px', borderRadius: 8, marginBottom: 32 }}>
            <h3>Upload Bug & Fix Pair</h3>
            <div>
              <label>Bug Description:</label><br />
              <textarea value={bugDesc} onChange={e => setBugDesc(e.target.value)} required rows={4} style={{ width: '100%', marginBottom: 12 }} />
            </div>
            <div>
              <label>Reference Fix Code (Python):</label><br />
              <textarea value={refCode} onChange={e => setRefCode(e.target.value)} required rows={6} style={{ width: '100%', fontFamily: 'monospace', marginBottom: 12 }} />
            </div>
            <button type="submit" disabled={isGenerating} style={{ padding: '10px 20px', background: '#0066cc', color: '#fff', border: 'none', borderRadius: 4 }}>
              {isGenerating ? 'Drafting Test Suite with Agent...' : 'Upload & Generate Ticket'}
            </button>
          </form>

          <h2>Your Company Tickets</h2>
          {tickets.map(ticket => (
            <div key={ticket.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4>Signature: <code>{ticket.function_signature}</code></h4>
                <span style={{ padding: '4px 8px', borderRadius: 4, background: ticket.status === 'approved' ? '#d4edda' : '#fff3cd' }}>
                  {ticket.status.toUpperCase()}
                </span>
              </div>
              <p>{ticket.bug_description}</p>
              <details style={{ margin: '12px 0' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Inspect Agent Test Suite (Human Review Checkpoint)</summary>
                <pre style={{ background: '#222', color: '#88e', padding: 12, borderRadius: 6, overflowX: 'auto' }}>
                  {ticket.generated_test_suite}
                </pre>
              </details>
              <div style={{ display: 'flex', gap: 8 }}>
                {ticket.status === 'pending_review' && (
                  <button onClick={() => handleApprove(ticket.id)} style={{ padding: '6px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: 4 }}>
                    Approve Ticket
                  </button>
                )}
                {ticket.status === 'approved' && (
                  <button onClick={() => handleAssign(ticket.id)} style={{ padding: '6px 12px', background: '#17a2b8', color: '#fff', border: 'none', borderRadius: 4 }}>
                    Assign to Candidate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <h2>Candidate Submission Results</h2>
          {submissions.map(sub => (
            <div key={sub.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h4>Candidate: {sub.assignments?.candidate_email || 'Direct Token Candidate'}</h4>
                <span style={{ fontSize: 20, fontWeight: 'bold', color: sub.test_passed ? '#28a745' : '#dc3545' }}>
                  Score: {sub.ai_score}/100 ({sub.test_passed ? 'PASSED' : 'FAILED'})
                </span>
              </div>
              <p><strong>Feedback:</strong> {sub.ai_feedback}</p>
              
              {sub.telemetry && (
                <div style={{ background: '#f0f4f8', padding: 12, borderRadius: 6, marginTop: 8 }}>
                  <strong>Telemetry Metrics:</strong>
                  <ul>
                    <li>Local Preview Runs: {sub.telemetry.preview_run_count ?? 0}</li>
                    <li>Time to First Submit: {sub.telemetry.time_to_first_submit_seconds ? `${sub.telemetry.time_to_first_submit_seconds}s` : 'N/A'}</li>
                    <li>Total Saves: {sub.telemetry.total_save_count ?? 0}</li>
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
