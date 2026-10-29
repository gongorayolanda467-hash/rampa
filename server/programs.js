// Directorio de programas que pueden pagar una rampa y reglas para saber cuáles le aplican a cada caso.
// Los requisitos cambian: revise esta lista al menos una vez al año.

const CHICAGO_ZIP = /^606\d{2}$|^60827$/;

const programs = [
  {
    id: 'cha',
    name: 'Acomodo razonable de CHA',
    org: 'Autoridad de Vivienda de Chicago (CHA)',
    pays: 'Total, en vivienda pública',
    who: 'Residentes de vivienda pública de CHA y participantes del programa de vales.',
    covers: 'En vivienda pública, CHA paga la modificación. Con vale, ayuda a encontrar una unidad accesible o ajusta el vale.',
    steps: [
      'Pida por escrito un "acomodo razonable" a CHA o a su administrador de propiedad.',
      'Adjunte una carta de su médico o proveedor de salud que diga que necesita entrada sin escalones.',
      'Guarde copia de todo y anote la fecha de entrega.',
      'Comparta con CHA la cotización de Rampa Fácil si se la piden.',
    ],
    docs: ['Carta de solicitud (en su panel hay una lista)', 'Carta del proveedor de salud', 'Cotización por escrito'],
    url: 'https://www.thecha.org',
    match: q => q.housing === 'cha' || q.housing === 'vale',
  },
  {
    id: 'seccion504',
    name: 'Sección 504 (edificio con fondos de HUD)',
    org: 'Dueño o administrador del edificio',
    pays: 'Total, salvo carga excesiva',
    who: 'Inquilinos de edificios con Sección 8 basada en proyecto u otros fondos federales.',
    covers: 'El proveedor de vivienda debe pagar la modificación, salvo que demuestre que es una carga financiera excesiva.',
    steps: [
      'Pida la rampa por escrito al administrador como acomodo razonable.',
      'Adjunte la carta de su proveedor de salud.',
      'Si no responden en un tiempo razonable, contacte a Access Living o a la oficina de Vivienda Justa de HUD.',
    ],
    docs: ['Carta de solicitud', 'Carta del proveedor de salud'],
    url: 'https://www.hud.gov/program_offices/fair_housing_equal_opp',
    match: q => q.housing === 'proyecto',
  },
  {
    id: 'hap',
    name: 'Home Accessibility Program (HAP)',
    org: 'Departamento de Vivienda de Chicago',
    pays: 'Total, sin costo',
    who: 'Personas de bajos ingresos con discapacidad en la ciudad de Chicago. Dueños o inquilinos con permiso del propietario.',
    covers: 'Modificaciones de accesibilidad como rampas, barandales y baños.',
    steps: [
      'Llame al 311 y pida el Home Accessibility Program.',
      'Llene la solicitud con comprobantes de ingresos de todo el hogar.',
      'Si renta, consiga el permiso por escrito del propietario.',
      'Espere la inspección del programa. Puede haber lista de espera.',
    ],
    docs: ['Identificación', 'Comprobantes de ingresos', 'Prueba de discapacidad', 'Permiso del propietario si renta'],
    url: 'https://www.chicago.gov/city/en/depts/doh.html',
    match: q => q.low_income && CHICAGO_ZIP.test(q.zip || ''),
  },
  {
    id: 'idhs',
    name: 'Home Services Program (IDHS)',
    org: 'Departamento de Servicios Humanos de Illinois',
    pays: 'Total o parcial',
    who: 'Personas con Medicaid y discapacidad que necesitan servicios en casa.',
    covers: 'Puede cubrir modificaciones al hogar como parte de su plan de servicios.',
    steps: [
      'Pida a su coordinador de casos de IDHS (o llame a la oficina local de Servicios de Rehabilitación) que incluya la rampa en su plan.',
      'Presente la cotización por escrito.',
      'Espere la aprobación antes de empezar la obra.',
    ],
    docs: ['Tarjeta de Medicaid', 'Cotización por escrito', 'Permiso del propietario si renta'],
    url: 'https://www.dhs.state.il.us',
    match: q => q.medicaid,
  },
  {
    id: 'va',
    name: 'Subvenciones HISA y SAH',
    org: 'Departamento de Asuntos de Veteranos (VA)',
    pays: 'Total o parcial',
    who: 'Veteranos con discapacidad.',
    covers: 'Subvenciones para adaptar la vivienda, incluidas rampas.',
    steps: [
      'Hable con su equipo de salud del VA para que le receten la modificación.',
      'Solicite la subvención en línea o en su oficina del VA.',
      'Presente la cotización por escrito.',
    ],
    docs: ['Documento de servicio militar', 'Receta o recomendación del VA', 'Cotización por escrito'],
    url: 'https://www.va.gov/housing-assistance/disability-housing-grants/',
    match: q => q.veteran,
  },
  {
    id: 'habitat',
    name: 'Reparaciones para dueños de casa',
    org: 'Habitat for Humanity Chicago y Rebuilding Together Metro Chicago',
    pays: 'Gratis o bajo costo',
    who: 'Dueños de casa de bajos ingresos, incluidos quienes compraron con el programa de compra de vivienda de Sección 8.',
    covers: 'Reparaciones y modificaciones de accesibilidad.',
    steps: [
      'Busque el programa de reparaciones de cada organización y revise si su zona está incluida.',
      'Llene la solicitud con prueba de propiedad e ingresos.',
    ],
    docs: ['Escritura o prueba de propiedad', 'Comprobantes de ingresos'],
    url: 'https://www.habitatchicago.org',
    match: q => q.housing === 'propia' && q.low_income,
  },
  {
    id: 'fha',
    name: 'Modificación razonable (Ley de Vivienda Justa)',
    org: 'Su propietario',
    pays: 'Permiso obligatorio; el pago depende del caso',
    who: 'Cualquier inquilino con discapacidad, incluidos quienes tienen vale de Sección 8 en casa privada.',
    covers: 'El propietario debe permitir la rampa. En vivienda privada, normalmente el costo lo cubre el inquilino o un programa.',
    steps: [
      'Pida el permiso por escrito con la carta modelo.',
      'Explique que la rampa la instalará un contratista con licencia y con permiso de la ciudad.',
      'Si el propietario se niega, contacte a Access Living.',
    ],
    docs: ['Carta de solicitud', 'Carta del proveedor de salud (si la piden)'],
    url: 'https://www.hud.gov/program_offices/fair_housing_equal_opp',
    match: q => ['vale', 'renta'].includes(q.housing),
  },
  {
    id: 'access',
    name: 'Orientación gratuita de Access Living',
    org: 'Access Living, centro de vida independiente de Chicago',
    pays: 'No paga la obra; le ayuda a conseguir quién la pague',
    who: 'Cualquier persona con discapacidad.',
    covers: 'Ayuda para hacer solicitudes, escribir al propietario y defender sus derechos de vivienda.',
    steps: ['Contacte a Access Living y explique que necesita una rampa.'],
    docs: [],
    url: 'https://www.accessliving.org',
    match: () => true,
  },
];

function matchPrograms(q) {
  return programs.filter(p => p.match(q)).map(({ match, ...rest }) => rest);
}

function publicPrograms() {
  return programs.map(({ match, ...rest }) => rest);
}

module.exports = { matchPrograms, publicPrograms };
