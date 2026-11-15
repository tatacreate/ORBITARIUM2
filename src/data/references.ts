export interface OfficialReferenceLink {
  id: string;
  agency: 'NASA' | 'CSA';
  title: string;
  subtitle: string;
  url: string;
}

export const OFFICIAL_REFERENCES: OfficialReferenceLink[] = [
  {
    id: 'nasa-se-guide',
    agency: 'NASA',
    title: 'Design & Develop a Science Mission (PDF)',
    subtitle: 'Official NASA Systems Engineering framework for scientific space missions, requirements, and trade-offs.',
    url: 'https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf?emrc=a454cf',
  },
  {
    id: 'nasa-gmat',
    agency: 'NASA',
    title: 'NASA General Mission Analysis Tool (GMAT)',
    subtitle: 'NASA’s open-source astrodynamics & trajectory optimization software (GSC-19468-1).',
    url: 'https://software.nasa.gov/software/GSC-19468-1',
  },
  {
    id: 'csa-games',
    agency: 'CSA',
    title: 'Canadian Space Agency Digital Games & Activities',
    subtitle: 'CSA interactive space science learning resources featuring Canadarm robotics and RADARSAT.',
    url: 'https://www.asc-csa.gc.ca/eng/youth-educators/digital-games-and-activities.asp',
  },
];
