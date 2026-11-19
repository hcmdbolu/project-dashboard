-- ============================================================================
-- GSL Enterprise Portfolio Management Dashboard - Seed Data (v3)
-- Departments: IT, Maintenance, Transport, Facilities
-- Campuses: Lekki, Ikoyi, Anthos, Anthony, All Campuses
-- ============================================================================

-- 1. Seed Departments
INSERT INTO public.departments (id, name, code, description) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'IT', 'IT', 'Information Technology, Enterprise Systems, Infrastructure & Cybersecurity'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Maintenance', 'MNT', 'Preventive & Corrective Plant, HVAC, Electrical & Building Maintenance'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'Transport', 'TRN', 'School Bus Fleet, Routing GPS Telemetry & Student Transit Safety'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'Facilities', 'FAC', 'Capital Works, Campus Grounds, Power Infrastructure & Security Upgrades')
ON CONFLICT (code) DO NOTHING;

-- 2. Seed Global Dynamic Categories
INSERT INTO public.categories (id, name, department_id) VALUES
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Infrastructure', NULL),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Software Applications', NULL),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'Cybersecurity', NULL),
  ('bbbbbbbb-0000-4000-8000-000000000004', 'Service Delivery', NULL),
  ('bbbbbbbb-0000-4000-8000-000000000005', 'Operations & Support', NULL),
  ('bbbbbbbb-0000-4000-8000-000000000006', 'Strategic Initiatives', NULL),
  ('bbbbbbbb-0000-4000-8000-000000000007', 'Fleet & Transport', NULL),
  ('bbbbbbbb-0000-4000-8000-000000000008', 'Facility Maintenance', NULL)
ON CONFLICT DO NOTHING;

-- 3. Seed Department Budgets (2026/2027 Session)
INSERT INTO public.department_budgets (
  id, department_id, fiscal_period, proposed_amount, approved_amount, status, review_notes
) VALUES
  ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '2026/2027 Session', 260000000.00, 250000000.00, 'Approved', 'Board-approved IT capital & software envelope.'),
  ('cccccccc-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000002', '2026/2027 Session', 85000000.00, 75000000.00, 'Approved', 'Approved HVAC & generator overhaul ceiling.'),
  ('cccccccc-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000003', '2026/2027 Session', 98000000.00, 0.00, 'Pending Approval', 'Awaiting Super Admin sign-off on Anthony fleet expansion.'),
  ('cccccccc-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000004', '2026/2027 Session', 120000000.00, 110000000.00, 'Approved', 'Approved solar-hybrid and perimeter security allocation.')
ON CONFLICT (department_id, fiscal_period) DO NOTHING;

-- 4. Seed Enterprise Multi-Department Projects (GSL-PROJECT-001 through 012)
INSERT INTO public.projects (
  id, project_code, department_id, category_id, name, campus,
  technical_lead_name, approval_authority,
  problem_solved, expected_benefit, savings_efficiency,
  percent_complete, schedule_status, rag_status,
  next_milestone, milestone_due_date, target_end_date,
  business_impact, risk_level, urgency, strategic_importance,
  approved_budget, actual_spend, procurement_status
) VALUES
  (
    '11111111-1111-4111-8111-111111111101', 'GSL-PROJECT-001',
    'aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
    'Campus Wi-Fi 6E Core Upgrade', 'Lekki',
    'Emeka Obi (Network Architect)', 'Executive Director',
    'High-density classrooms and boarding houses experience Wi-Fi drops during CBT exams.',
    'Seamless 10Gbps core wireless coverage supporting 2,500+ concurrent devices.',
    'Cuts network downtime by 80% (~₦3.2M/yr saved).',
    72, 'Behind Schedule', 'Amber',
    'Boarding Block AP Cutover', '2026-11-24', '2026-12-15',
    4.80, 4.50, 4.90, 4.80,
    45000000.00, 34200000.00, 'Delivered'
  ),
  (
    '11111111-1111-4111-8111-111111111102', 'GSL-PROJECT-002',
    'aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002',
    'Unified Student Information System (SIS) v3', 'All Campuses',
    'Tolu Adeyemi (Lead Systems Engineer)', 'GSL Executive Board',
    'Fragmented academic records delay report card publishing and admissions.',
    'Single source of truth for student attendance, grading, and parent portal.',
    'Saves ~120 staff-hours per term on manual grade consolidation.',
    54, 'Behind Schedule', 'Red',
    'Term 1 Transcript Checksum Sign-Off', '2026-11-21', '2026-11-30',
    5.00, 4.90, 5.00, 4.90,
    68000000.00, 49500000.00, 'PO Issued'
  ),
  (
    '11111111-1111-4111-8111-111111111103', 'GSL-PROJECT-003',
    'aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000003',
    'Zero-Trust Endpoint & Firewall Rollout', 'All Campuses',
    'Kemi Adebayo (InfoSec Lead)', 'IT Steering Committee',
    'Rising phishing and ransomware exposure across staff endpoints.',
    'Zero-trust conditional access and automated EDR threat containment.',
    'Cuts manual endpoint patching effort by 65%.',
    85, 'On Schedule', 'Green',
    'Staff MFA 100% Enforcement', '2026-11-25', '2026-12-05',
    4.90, 4.80, 4.70, 4.60,
    32000000.00, 26800000.00, 'Delivered'
  ),
  (
    '11111111-1111-4111-8111-111111111104', 'GSL-PROJECT-004',
    'aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000004',
    'Interactive Smartboard Classroom Refresh', 'Ikoyi',
    'Femi Ogunleye (AV Specialist)', 'Chief Operating Officer',
    'Aging projectors suffer dim lamps and calibration drift.',
    '4K touch interactive panels with wireless casting in every classroom.',
    'Eliminates recurring bulb replacements (~₦1.8M/yr).',
    92, 'On Schedule', 'Green',
    'Final 4 Humanities Rooms Handover', '2026-11-22', '2026-11-28',
    4.30, 3.40, 4.20, 4.40,
    28500000.00, 25900000.00, 'Delivered'
  ),
  (
    '11111111-1111-4111-8111-111111111105', 'GSL-PROJECT-005',
    'aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000006',
    'Assistive Learning Tech & Sensory Lab Network', 'Anthos',
    'Seyi Lawal (EdTech Engineer)', 'Executive Director',
    'Anthos House requires dedicated low-latency Wi-Fi and AAC devices.',
    'Tailored assistive hardware and sensory lab monitoring network.',
    'Reduces manual therapist documentation time by 35%.',
    40, 'Behind Schedule', 'Red',
    'AAC Hardware Customs Release', '2026-11-21', '2026-12-10',
    4.90, 4.60, 4.80, 4.70,
    19000000.00, 11400000.00, 'PO Issued'
  ),
  (
    '11111111-1111-4111-8111-111111111106', 'GSL-PROJECT-006',
    'aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000005',
    'Cloud Backup & Disaster Recovery Automation', 'All Campuses',
    'Tolu Adeyemi (Systems Engineer)', 'IT Steering Committee',
    'Manual NAS backups lacked immutable offsite copies.',
    'Automated immutable cloud backups with <2 hour RTO.',
    'Saves 18 IT ops hours/month.',
    100, 'Completed', 'Blue',
    'Completed & DR Certified', '2026-10-30', '2026-10-30',
    4.60, 4.70, 4.20, 4.50,
    22000000.00, 20400000.00, 'Delivered'
  ),
  (
    '11111111-1111-4111-8111-111111111107', 'GSL-PROJECT-007',
    'aaaaaaaa-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000008',
    'Anthony Campus HVAC Chiller Overhaul', 'Anthony',
    'Engr. Kunle Adeola', 'Chief Operating Officer',
    'Frequent compressor faults in Anthony Science & Admin blocks.',
    'High-efficiency variable-refrigerant HVAC units across 18 classrooms.',
    'Cuts cooling power draw by 28% (~₦4.2M/yr).',
    68, 'On Schedule', 'Green',
    'Chiller Bank Commissioning', '2026-12-03', '2026-12-20',
    4.40, 3.80, 4.30, 4.10,
    34000000.00, 22500000.00, 'PO Issued'
  ),
  (
    '11111111-1111-4111-8111-111111111108', 'GSL-PROJECT-008',
    'aaaaaaaa-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000008',
    'Lekki Hostel Plumbing & Water Treatment Upgrade', 'Lekki',
    'Engr. Musa Bello', 'Facilities & Maintenance Director',
    'Low pressure and iron sediment in senior boarding water lines.',
    'Automated dual-stage reverse osmosis and booster pump manifold.',
    'Eliminates emergency tanker water purchases (~₦2.9M/yr).',
    48, 'Behind Schedule', 'Amber',
    'RO Filtration Skid Delivery', '2026-11-28', '2027-01-12',
    4.50, 4.10, 4.40, 4.00,
    26500000.00, 14800000.00, 'Vendor Selected'
  ),
  (
    '11111111-1111-4111-8111-111111111109', 'GSL-PROJECT-009',
    'aaaaaaaa-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000007',
    'Anthony & Lekki School Bus GPS Telemetry Rollout', 'All Campuses',
    'Sadiq Ibrahim (Fleet Telematics)', 'Chief Operating Officer',
    'Parents lack live ETA visibility and speed compliance alerts.',
    'Live parent bus-tracking app, RFID student boarding, and dashcams.',
    'Cuts idle fuel burn by 15% (~₦5.1M/yr).',
    76, 'On Schedule', 'Green',
    'Anthony Route RFID Pilot', '2026-11-29', '2026-12-18',
    4.60, 3.90, 4.40, 4.50,
    18500000.00, 13200000.00, 'Delivered'
  ),
  (
    '11111111-1111-4111-8111-111111111110', 'GSL-PROJECT-010',
    'aaaaaaaa-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000007',
    'Anthony 32-Seater Coaster Fleet Replacement', 'Anthony',
    'Babatunde Cole (Fleet Lead)', 'GSL Executive Board',
    'Three aging Anthony route buses exceed annual maintenance thresholds.',
    'Three new Euro-5 AC school buses with 3-point seatbelts.',
    'Saves ₦7.8M/yr in corrective engine and transmission repairs.',
    30, 'Behind Schedule', 'Red',
    'Chassis Inspection & Registration', '2026-12-08', '2027-01-25',
    4.80, 4.40, 4.60, 4.70,
    72000000.00, 21600000.00, 'RFQ / Tendering'
  ),
  (
    '11111111-1111-4111-8111-111111111111', 'GSL-PROJECT-011',
    'aaaaaaaa-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000001',
    'Solar-Hybrid Power Redundancy Phase 2', 'Lekki',
    'Engr. Kunle Adeola', 'Executive Director',
    'Diesel generator changeover spikes interrupt campus operations.',
    '24/7 solar-hybrid lithium redundancy for Lekki core buildings.',
    'Projected diesel savings of ₦11.5M/yr.',
    60, 'On Schedule', 'Amber',
    'Lithium Battery Rack Commissioning', '2026-12-12', '2027-01-15',
    4.70, 4.30, 4.20, 4.50,
    54000000.00, 32500000.00, 'PO Issued'
  ),
  (
    '11111111-1111-4111-8111-111111111112', 'GSL-PROJECT-012',
    'aaaaaaaa-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000001',
    'Ikoyi & Anthony Perimeter CCTV & Gate Automation', 'Ikoyi',
    'Chief Security Officer', 'Chief Operating Officer',
    'Manual visitor logs at Ikoyi and Anthony gates slow drop-off.',
    'Automated turnstiles, ANPR cameras, and unified security desk.',
    'Cuts gate check-in queues by 60%.',
    100, 'Completed', 'Blue',
    'Completed & Handed Over', '2026-10-20', '2026-10-20',
    4.30, 3.80, 4.00, 4.20,
    31500000.00, 29800000.00, 'Delivered'
  )
ON CONFLICT (project_code) DO NOTHING;

-- Advance auto-code sequence past seeded 12 projects so next project is GSL-PROJECT-013
SELECT setval('public.gsl_project_code_seq', 12, true);

-- 5. Seed Risks
INSERT INTO public.risks (project_id, department_id, description, severity, mitigation_plan, status, risk_owner, target_date) VALUES
  ('11111111-1111-4111-8111-111111111102', 'aaaaaaaa-0000-4000-8000-000000000001', 'Legacy student transcript migration failing checksum validation for 2019-2021 cohorts.', 'Critical', 'Run automated schema cleansing script and parallel QA sampling.', 'Open', 'Tolu Adeyemi', '2026-11-22'),
  ('11111111-1111-4111-8111-111111111105', 'aaaaaaaa-0000-4000-8000-000000000001', 'Customs clearance delay on specialized AAC tablets and tactile controllers.', 'Critical', 'Escalate clearance broker docs and stage backup loaner iPads.', 'Open', 'Procurement Manager', '2026-11-24'),
  ('11111111-1111-4111-8111-111111111110', 'aaaaaaaa-0000-4000-8000-000000000003', 'Chassis import quote subject to 12% FX variance before LC issuance.', 'Critical', 'Lock FX forward tranche via CFO or phase 2 buses first.', 'Open', 'Babatunde Cole', '2026-11-26'),
  ('11111111-1111-4111-8111-111111111101', 'aaaaaaaa-0000-4000-8000-000000000001', 'Fiber trenching across Lekki boarding block paused pending civil works sign-off.', 'High', 'Use temporary directional wireless bridge awaiting trench permit.', 'Open', 'Emeka Obi', '2026-11-25'),
  ('11111111-1111-4111-8111-111111111108', 'aaaaaaaa-0000-4000-8000-000000000002', 'Port congestion delaying RO membrane vessel delivery to Lekki.', 'High', 'Source alternate local stainless housing to avoid schedule slip.', 'Open', 'Engr. Musa Bello', '2026-11-29'),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000004', 'Inverter rack quote expiry within 10 business days.', 'High', 'Expedite final PO tranche sign-off.', 'Open', 'Engr. Kunle Adeola', '2026-11-27');

-- 6. Seed Leadership Actions
INSERT INTO public.leadership_actions (
  project_id, department_id, decision_required, required_by, decision_owner, due_date, impact_if_delayed, status
) VALUES
  ('11111111-1111-4111-8111-111111111102', 'aaaaaaaa-0000-4000-8000-000000000001', 'Approve 2-week SIS cutover deferral or authorize weekend data reconciliation.', 'SIS Program Manager', 'Director of Academics & Executive Director', '2026-11-05', 'Term 1 report cards risk delayed publication.', 'Overdue'),
  ('11111111-1111-4111-8111-111111111105', 'aaaaaaaa-0000-4000-8000-000000000001', 'Authorize emergency air-freight supplement (₦2.4M) for Anthos AAC hardware.', 'Head of Anthos House', 'Chief Financial Officer', '2026-11-08', 'Sensory Lab launch slips into next term.', 'Overdue'),
  ('11111111-1111-4111-8111-111111111110', 'aaaaaaaa-0000-4000-8000-000000000003', 'Approve Transport 2026/2027 budget request and vendor selection for Anthony buses.', 'Transport Manager', 'Super Admin & CFO', '2026-11-14', 'Bus delivery misses Term 2 opening week.', 'Overdue'),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000004', 'Approve FX contingency drawdown of ₦4.8M for Lekki solar-hybrid battery bank.', 'Facilities Director', 'Chief Financial Officer', '2026-11-24', 'Vendor quote expires adding 6-week delay.', 'Pending Decision'),
  ('11111111-1111-4111-8111-111111111108', 'aaaaaaaa-0000-4000-8000-000000000002', 'Approve weekend hostel water shutdown window for manifold tie-in.', 'Maintenance Lead', 'Lekki Head of School', '2026-11-27', 'Pump commissioning pushes into exam week.', 'In Review');
