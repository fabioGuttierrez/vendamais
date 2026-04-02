-- Migration 004: Analytics views

CREATE OR REPLACE VIEW analytics_conversion_funnel AS
SELECT
  stage,
  COUNT(*) as deal_count,
  COALESCE(SUM(estimated_value), 0) as total_value,
  ROUND(AVG(probability), 1) as avg_probability
FROM deals
GROUP BY stage
ORDER BY
  CASE stage
    WHEN 'new_lead' THEN 1
    WHEN 'contacted' THEN 2
    WHEN 'qualified' THEN 3
    WHEN 'proposal_sent' THEN 4
    WHEN 'negotiation' THEN 5
    WHEN 'won' THEN 6
    WHEN 'lost' THEN 7
  END;

CREATE OR REPLACE VIEW analytics_daily_messages AS
SELECT
  DATE(created_at) as day,
  COUNT(*) FILTER (WHERE direction = 'inbound') as inbound_count,
  COUNT(*) FILTER (WHERE direction = 'outbound') as outbound_count,
  COUNT(*) as total
FROM messages
WHERE created_at > now() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY day DESC;

CREATE OR REPLACE VIEW analytics_objection_frequency AS
SELECT
  objection_type,
  COUNT(*) as occurrence_count,
  COUNT(*) FILTER (WHERE was_resolved = true) as resolved_count,
  ROUND(
    COUNT(*) FILTER (WHERE was_resolved = true)::numeric / NULLIF(COUNT(*), 0) * 100, 1
  ) as resolution_rate
FROM objections_log
GROUP BY objection_type
ORDER BY occurrence_count DESC;

CREATE OR REPLACE VIEW analytics_response_times AS
SELECT
  DATE(m_in.created_at) as day,
  AVG(EXTRACT(EPOCH FROM (m_out.created_at - m_in.created_at))) as avg_seconds,
  PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (m_out.created_at - m_in.created_at))
  ) as median_seconds
FROM messages m_in
JOIN LATERAL (
  SELECT created_at
  FROM messages m_out
  WHERE m_out.conversation_id = m_in.conversation_id
    AND m_out.direction = 'outbound'
    AND m_out.created_at > m_in.created_at
  ORDER BY m_out.created_at
  LIMIT 1
) m_out ON true
WHERE m_in.direction = 'inbound'
  AND m_in.created_at > now() - INTERVAL '30 days'
GROUP BY DATE(m_in.created_at)
ORDER BY day DESC;
