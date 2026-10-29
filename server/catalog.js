// Catálogo de modelos y acabados. Es la única fuente: lo usan la API, la validación y el formulario.

const products = [
  { id: 'recta', code: 'A', name: 'Rampa recta', rise: 'hasta 30"', ideal: 'Jardines frontales largos. La más fácil de usar, sin giros.' },
  { id: 'l', code: 'B', name: 'Rampa en L', rise: '24"–60"', ideal: 'Lotes de esquina y entradas laterales.' },
  { id: 'u', code: 'C', name: 'Rampa en U', rise: '30"–60" o más', ideal: 'Frentes angostos de 25 pies, típicos de Chicago.' },
  { id: 'umbral', code: 'D', name: 'Rampa corta de umbral', rise: 'hasta 6"', ideal: 'Un escalón, umbral de puerta, balcón o patio.' },
  { id: 'modular', code: 'E', name: 'Rampa modular removible', rise: 'cualquier altura', ideal: 'Inquilinos con vale Sección 8. Se instala sin excavar.' },
  { id: 'no-se', code: '?', name: 'No sé, necesito asesoría', rise: '', ideal: 'Le recomendamos el modelo en la visita.' },
];

const finishes = [
  { id: 'jardin', name: 'Camino de jardín', material: 'Adoquín, muro de piedra y plantas' },
  { id: 'ladrillo', name: 'Ladrillo y herrería', material: 'Ladrillo, piedra caliza y barandal de hierro' },
  { id: 'moderno', name: 'Concreto y vidrio', material: 'Concreto, vidrio templado, acero inoxidable y LED' },
  { id: 'porche', name: 'Porche compuesto', material: 'Madera compuesta, barandal blanco y celosía' },
  { id: 'aluminio', name: 'Aluminio bronce', material: 'Aluminio con pintura en polvo y faldón' },
  { id: 'cedro', name: 'Cedro con pérgola', material: 'Cedro teñido y barandal de cable' },
  { id: 'basico', name: 'Funcional básico', material: 'Madera tratada o aluminio natural' },
];

const housing = [
  { id: 'propia', name: 'Casa propia' },
  { id: 'vale', name: 'Inquilino con vale Sección 8 (Housing Choice Voucher)' },
  { id: 'cha', name: 'Vivienda pública de CHA' },
  { id: 'proyecto', name: 'Edificio con Sección 8 basada en proyecto' },
  { id: 'renta', name: 'Renta sin subsidio' },
  { id: 'otro', name: 'Otro' },
];

const mobility = [
  { id: 'manual', name: 'Silla de ruedas manual' },
  { id: 'electrica', name: 'Silla eléctrica o scooter' },
  { id: 'andadera', name: 'Andadera, bastón o muletas' },
  { id: 'mayor', name: 'Adulto mayor o poca resistencia' },
  { id: 'vision', name: 'Baja visión o ceguera' },
  { id: 'otro', name: 'Otra necesidad' },
];

const contactPrefs = [
  { id: 'telefono', name: 'Llamada' },
  { id: 'texto', name: 'Mensaje de texto' },
  { id: 'correo', name: 'Correo electrónico' },
];

const statuses = [
  { id: 'nuevo', name: 'Recibida' },
  { id: 'revision', name: 'En revisión' },
  { id: 'visita', name: 'Visita programada' },
  { id: 'cotizada', name: 'Cotización enviada' },
  { id: 'aceptada', name: 'Aceptada' },
  { id: 'instalacion', name: 'Instalación programada' },
  { id: 'completada', name: 'Completada' },
  { id: 'cancelada', name: 'Cancelada' },
];

const funderKinds = [
  { id: 'programa', name: 'Programa público o de gobierno' },
  { id: 'vivienda', name: 'Autoridad o administrador de vivienda' },
  { id: 'propietario', name: 'Propietario o casero' },
  { id: 'ong', name: 'Organización sin fines de lucro' },
  { id: 'empresa', name: 'Empresa o fundación' },
  { id: 'donante', name: 'Donante individual o familiar' },
];

const coverages = [
  { id: 'total', name: 'Pago total' },
  { id: 'parcial', name: 'Pago parcial' },
];

const offerStatuses = [
  { id: 'pendiente', name: 'Esperando respuesta' },
  { id: 'aceptada', name: 'Aceptada' },
  { id: 'rechazada', name: 'No aceptada' },
  { id: 'retirada', name: 'Retirada' },
];

// Precio orientativo por pie lineal instalado (rampa + descansos), en dólares.
// AJUSTE ESTOS VALORES a los precios reales del negocio.
const pricePerFoot = {
  basico: [120, 200], aluminio: [160, 260], cedro: [180, 300], porche: [200, 320],
  jardin: [250, 450], moderno: [350, 600], ladrillo: [400, 700],
};

const round100 = n => Math.round(n / 100) * 100;

// Estimado orientativo: largo a pendiente 1:12 más descansos de 5 pies; mínimo 500 dólares.
function estimate(product, finish, riseIn) {
  const rise = Math.max(1, Number(riseIn) || 1);
  if (product === 'umbral' || rise <= 6) return { low: 300, high: 1200, feet: Math.ceil(rise) };
  const segments = Math.ceil(rise / 30);
  const feet = Math.ceil(rise + 5 * (segments + 1));
  const [lo, hi] = pricePerFoot[finish] || pricePerFoot.basico;
  return { low: Math.max(500, round100(feet * lo)), high: Math.max(900, round100(feet * hi)), feet };
}

const ids = list => list.map(x => x.id);

module.exports = {
  products, finishes, housing, mobility, contactPrefs, statuses, funderKinds, coverages, offerStatuses, pricePerFoot, estimate, ids,
};
