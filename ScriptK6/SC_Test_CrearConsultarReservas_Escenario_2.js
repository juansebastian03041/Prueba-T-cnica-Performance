import http from 'k6/http'; // Importar la librería HTTP de K6 para realizar las solicitudes HTTP.
import { check, sleep } from 'k6'; // Importar funciones para validaciones (check) y pausas entre iteraciones (sleep).
import { SharedArray } from 'k6/data'; // Importar SharedArray para cargar y compartir datos entre los VUs (usuarios virtuales).

// Cargar datos desde el archivo el cual contine la data para el flujo de crear una reserva.
// SharedArray se asegura de cargar los datos una vez y compartirlos entre todos los VUs.
const data = new SharedArray('Cargar datos de clientes', () =>
    open('D:\\Otros_Datos\\SREYES\\Prueba\\Script-K6\\DT_Clientes_ficticios_1.txt')
        .split('\n') // Dividir el archivo en líneas.
        .map((line) => line.split(',')) // Dividir cada línea en columnas (asumiendo que están separadas por comas).
);

// Configuración de los tres escenarios de prueba.
export const options = {
  scenarios: {
    // Escenario 2: Carga Moderada
    carga_moderada: {
      executor: 'ramping-arrival-rate', // Usar el mismo tipo de executor.
      startRate: 10, // Tasa inicial de usuarios por segundo.
      timeUnit: '1s', // Unidad de tiempo para la tasa de llegada.
      preAllocatedVUs: 50, // Reservar 50 usuarios virtuales.
      stages: [
        { duration: '1m', target: 50 }, // Ramp-up: Incrementar a 50 usuarios concurrentes en 1 minuto.
        { duration: '5m', target: 50 }, // Mantener 50 usuarios concurrentes por 5 minutos.
      ],
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<800'], // El 95% de las solicitudes debe responder en menos de 800 ms.
    'http_req_failed': ['rate<0.05'], // Menos del 5% de las solicitudes deben fallar.
  },
};

// Función principal que se ejecuta en cada iteración del script.
export default function () {
  // Seleccionar un registro aleatorio del archivo cargado.
  const randomIndex = Math.floor(Math.random() * data.length); // Generar un índice aleatorio.
  const firstname = data[randomIndex][0]; // Obtener el nombre (primera columna del archivo).
  const lastname = data[randomIndex][1]; // Obtener el apellido (segunda columna del archivo).

  // Construir el cuerpo de la solicitud para CREAR una RESERVA.
  const createPayload = JSON.stringify({
    firstname: firstname, // Nombre obtenido del archivo.
    lastname: lastname, // Apellido obtenido del archivo.
    totalprice: 30000, // Precio total fijo.
    depositpaid: true, // Depósito pagado fijo.
    bookingdates: {
      checkin: '2025-01-05', // Fecha de check-in fija.
      checkout: '2025-01-20', // Fecha de check-out fija.
    },
    additionalneeds: 'Prueba de Performance', // Necesidad adicional fija.
  });

  // Definir los headers para las solicitudes HTTP.
  const headers = {
    'Content-Type': 'application/json', // Tipo de contenido en JSON.
    Accept: 'application/json', // Especificar que se espera una respuesta en JSON.
  };

  // Solicitud POST para crear una reserva.
  const createResponse = http.post(
    'https://restful-booker.herokuapp.com/booking', // URL del endpoint para crear una reserva.
    createPayload, // Cuerpo de la solicitud.
    { headers: headers } // Headers de la solicitud.
  );

  // Validar la respuesta de la solicitud POST.
  check(createResponse, {
    'Create booking: Status is 200': (res) => res.status === 200, // Verificar que el código de estado sea 200.
    'Create booking: Booking ID present': (res) =>
      JSON.parse(res.body).bookingid !== undefined, // Verificar que la respuesta contiene un booking ID.
  });

  // Obtener el booking ID de la respuesta.
  const bookingid = JSON.parse(createResponse.body).bookingid;

  // Construir la URL para consultar la reserva creada.
  const getBookingURL = `https://restful-booker.herokuapp.com/booking/${bookingid}`;

  // Solicitud GET para consultar la reserva.
  const getResponse = http.get(getBookingURL, { headers: headers });

  // Validar la respuesta de la solicitud GET.
  check(getResponse, {
    'Get booking: Status is 200': (res) => res.status === 200, // Verificar que el código de estado sea 200.
    'Get booking: Firstname matches': (res) =>
      JSON.parse(res.body).firstname === firstname, // Verificar que el nombre coincide con el enviado.
    'Get booking: Lastname matches': (res) =>
      JSON.parse(res.body).lastname === lastname, // Verificar que el apellido coincide con el enviado.
  });

  sleep(1); // Pausar 1 segundo entre iteraciones para evitar sobrecarga.
}