/**
 * Seed data for all consultation types.
 * Hierarchy: root types at the top level, children nested under each.
 *
 * Run via: npm run seed:consultation-types
 * See: scripts/seed-consultation-types.mjs
 */

export interface SeedConsultationType {
  name: string;
  description: string;
  employmentType?: "INDEPENDENT" | "SALARIED";
  children?: SeedConsultationType[];
}

export const consultationTypeSeed: SeedConsultationType[] = [
  {
    name: "General Practice",
    description: "Primary healthcare services covering general health concerns, preventive care, and routine consultations.",
    children: [
      { name: "General Consultation", description: "Initial or routine visit for general health assessment and advice." },
      { name: "Follow-up Visit", description: "Scheduled review of an existing condition, treatment plan, or test results." },
      { name: "Health Screening & Check-up", description: "Preventive wellness checks including blood pressure, BMI, vision, and general vitals." },
      { name: "Chronic Disease Management", description: "Ongoing care and monitoring for long-term conditions such as diabetes, hypertension, and asthma." },
      { name: "Prescription Renewal", description: "Review and renewal of existing prescriptions and medications." },
    ],
  },
  {
    name: "Nursing Care",
    description: "Professional nursing services delivered at home or in a clinical setting.",
    children: [
      { name: "Wound Dressing & Care", description: "Cleaning, dressing, and monitoring of surgical or traumatic wounds." },
      { name: "IV Therapy & Infusion", description: "Intravenous medication administration, drips, and fluid therapy." },
      { name: "Medication Administration", description: "Safe administration of prescribed oral, injectable, or topical medications." },
      { name: "Post-Surgical Nursing", description: "Post-operative care, monitoring, and support after surgical procedures." },
      { name: "Catheter Care", description: "Insertion, maintenance, and removal of urinary or central catheters." },
      { name: "Vital Signs Monitoring", description: "Regular monitoring of blood pressure, temperature, pulse, oxygen saturation, and respiratory rate." },
      { name: "Stoma Care", description: "Management and care of colostomy, ileostomy, and urostomy bags." },
    ],
  },
  {
    name: "Medical Specialties",
    description: "Specialist physician consultations across a wide range of medical disciplines.",
    children: [
      { name: "Cardiology", description: "Diagnosis and management of heart and cardiovascular conditions." },
      { name: "Dermatology", description: "Treatment of skin, hair, and nail conditions." },
      { name: "Neurology", description: "Assessment and management of brain, spinal cord, and nervous system disorders." },
      { name: "Orthopedics", description: "Musculoskeletal conditions including bones, joints, muscles, tendons, and ligaments." },
      { name: "Ophthalmology", description: "Eye health, vision assessment, and treatment of eye diseases." },
      { name: "ENT (Ear, Nose & Throat)", description: "Conditions affecting the ears, nose, throat, head, and neck." },
      { name: "Urology", description: "Disorders of the urinary tract and male reproductive system." },
      { name: "Gastroenterology", description: "Digestive system conditions including the stomach, intestines, liver, and pancreas." },
      { name: "Endocrinology", description: "Hormonal and metabolic disorders including thyroid, adrenal, and pituitary conditions." },
      { name: "Oncology", description: "Diagnosis, treatment, and management of cancer." },
      { name: "Pulmonology", description: "Respiratory conditions including asthma, COPD, pneumonia, and lung disease." },
      { name: "Nephrology", description: "Kidney function, chronic kidney disease, dialysis, and renal conditions." },
      { name: "Rheumatology", description: "Autoimmune and inflammatory conditions including arthritis, lupus, and gout." },
      { name: "Hematology", description: "Blood disorders including anaemia, clotting disorders, and blood cancers." },
      { name: "Infectious Diseases", description: "Diagnosis and management of bacterial, viral, fungal, and parasitic infections." },
    ],
  },
  {
    name: "Surgery",
    description: "Pre-operative assessment, surgical consultation, and post-operative follow-up services.",
    children: [
      { name: "Pre-operative Assessment", description: "Medical evaluation and preparation before a planned surgical procedure." },
      { name: "Post-operative Follow-up", description: "Review and monitoring of recovery after surgery." },
      { name: "Minor Surgical Procedures", description: "Small procedures including excisions, incisions, suturing, and biopsies." },
      { name: "Surgical Consultation", description: "Specialist surgical opinion and treatment planning." },
    ],
  },
  {
    name: "Mental Health",
    description: "Psychological, psychiatric, and emotional wellness services.",
    children: [
      { name: "Psychiatric Assessment & Review", description: "Comprehensive evaluation of mental health conditions and medication management." },
      { name: "Individual Therapy", description: "One-on-one psychotherapy sessions including CBT, DBT, and counselling approaches." },
      { name: "Group Therapy", description: "Facilitated group sessions for shared mental health or recovery challenges." },
      { name: "Counselling & Support", description: "Emotional and psychological support for life challenges, grief, and relationship issues." },
      { name: "Addiction & Rehabilitation", description: "Support and treatment for substance use disorders and behavioural addictions." },
      { name: "Child & Adolescent Psychiatry", description: "Mental health services tailored for children and teenagers." },
    ],
  },
  {
    name: "Allied Health & Therapy",
    description: "Rehabilitation and therapy services supporting recovery, function, and wellness.",
    children: [
      { name: "Physiotherapy", description: "Physical rehabilitation for injuries, post-surgery recovery, and musculoskeletal conditions." },
      { name: "Occupational Therapy", description: "Support to regain independence in daily activities after illness, injury, or disability." },
      { name: "Speech & Language Therapy", description: "Assessment and treatment of speech, language, communication, and swallowing difficulties." },
      { name: "Dietetics & Nutrition", description: "Medical nutrition therapy, dietary planning, and nutritional counselling." },
      { name: "Podiatry", description: "Foot and lower limb conditions, diabetic foot care, and biomechanical assessment." },
      { name: "Chiropractic Care", description: "Spinal manipulation and musculoskeletal therapy for back, neck, and joint pain." },
    ],
  },
  {
    name: "Maternal & Reproductive Health",
    description: "Pregnancy, childbirth, postpartum, and reproductive health services.",
    children: [
      { name: "Antenatal Care", description: "Monitoring and support for pregnant women throughout pregnancy." },
      { name: "Postnatal Care", description: "Care for mother and newborn in the days and weeks following birth." },
      { name: "Midwifery Services", description: "Skilled midwifery care during pregnancy, labour, and the postnatal period." },
      { name: "Family Planning & Counselling", description: "Contraception advice, fertility support, and reproductive health counselling." },
      { name: "Gynaecology Consultation", description: "Assessment and treatment of female reproductive health conditions." },
    ],
  },
  {
    name: "Paediatrics & Child Health",
    description: "Medical care and services for infants, children, and adolescents.",
    children: [
      { name: "Paediatric Consultation", description: "General health assessment and management for children from birth to 18 years." },
      { name: "Immunisation & Vaccination", description: "Routine childhood immunisations and catch-up vaccination schedules." },
      { name: "Child Development Assessment", description: "Evaluation of growth milestones, developmental delays, and learning difficulties." },
      { name: "Neonatal Care", description: "Specialised care for newborns, including premature and high-risk infants." },
    ],
  },
  {
    name: "Geriatrics & Elderly Care",
    description: "Comprehensive healthcare and support services for the elderly and aged population.",
    children: [
      { name: "Geriatric Assessment", description: "Holistic evaluation of medical, functional, psychological, and social needs of older adults." },
      { name: "Dementia & Memory Care", description: "Specialist care and support for patients with dementia, Alzheimer's, and memory disorders." },
      { name: "Palliative & Hospice Care", description: "Comfort-focused care for patients with life-limiting illnesses, emphasising quality of life." },
      { name: "Mobility & Fall Prevention", description: "Assessment and interventions to improve mobility and reduce fall risk in the elderly." },
      { name: "Continence Care", description: "Assessment and management of bladder and bowel incontinence in older adults." },
    ],
  },
  {
    name: "Home Care & Personal Assistance",
    description: "Non-clinical and supportive care services delivered in the patient's home.",
    employmentType: "INDEPENDENT",
    children: [
      { name: "Personal Care Assistance", description: "Help with bathing, grooming, dressing, and personal hygiene for those with limited mobility." },
      { name: "Companionship & Social Care", description: "Social engagement, emotional support, and companionship for isolated or elderly individuals." },
      { name: "Respite Care", description: "Temporary relief care for family caregivers, providing a break from caring responsibilities." },
      { name: "Meal Preparation & Support", description: "Preparation of nutritious meals and assistance with feeding where required." },
      { name: "Medication Reminders", description: "Non-clinical reminders and supervision to ensure medications are taken as prescribed." },
    ],
  },
  {
    name: "Diagnostic Services",
    description: "On-site or home-based diagnostic and laboratory services.",
    employmentType: "INDEPENDENT",
    children: [
      { name: "Blood Tests & Phlebotomy", description: "Sample collection for full blood count, metabolic panels, hormone tests, and more." },
      { name: "Urinalysis", description: "Urine sample testing for infection, kidney function, glucose, and other markers." },
      { name: "ECG (Electrocardiogram)", description: "Recording of electrical activity of the heart to detect arrhythmias and cardiac conditions." },
      { name: "Blood Glucose Monitoring", description: "Point-of-care blood sugar testing for diabetic management and screening." },
      { name: "Medical Imaging Interpretation", description: "Radiologist review and report of X-rays, MRI, CT scans, and ultrasound images." },
    ],
  },
  {
    name: "Emergency & Urgent Care",
    description: "Immediate medical assessment and care for acute, urgent, or emergency conditions.",
    employmentType: "SALARIED",
    children: [
      { name: "Emergency Assessment", description: "Rapid triage and clinical assessment of acute medical emergencies." },
      { name: "Urgent Care Visit", description: "Same-day consultation for conditions requiring prompt but non-emergency attention." },
      { name: "First Aid & Stabilisation", description: "Immediate first aid intervention and patient stabilisation before transfer or further care." },
    ],
  },
  {
    name: "Dental & Oral Health",
    description: "Dental consultations and oral health services.",
    children: [
      { name: "General Dentistry", description: "Routine dental care including fillings, extractions, and oral health advice." },
      { name: "Oral Examination & Cleaning", description: "Comprehensive dental check-up, scale, and polish." },
      { name: "Orthodontic Consultation", description: "Assessment and treatment planning for teeth alignment and bite correction." },
      { name: "Oral Surgery Consultation", description: "Specialist consultation for complex dental extractions, implants, and jaw procedures." },
    ],
  },
  {
    name: "Optical & Eye Care",
    description: "Vision testing and optical health services.",
    children: [
      { name: "Vision Testing & Refraction", description: "Eye examination to assess visual acuity and prescribe corrective lenses." },
      { name: "Contact Lens Assessment", description: "Fitting and review of contact lenses for vision correction." },
      { name: "Low Vision Rehabilitation", description: "Support and devices for patients with significant vision impairment." },
    ],
  },
];
