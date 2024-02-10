$(document).ready(function() {
  // Manejar el evento de envío del formulario
  $('#tuFormulario').submit(function(event) {
    // Prevenir el comportamiento predeterminado del formulario
    event.preventDefault();

    // Realizar la solicitud AJAX al servidor
    $.ajax({
      url: '/backend/guardar-pedido',
      method: 'POST',
      data: $(this).serialize(), // Serializar el formulario para enviar los datos
      success: function(response) {
        // Mostrar un mensaje de alerta con la respuesta del servidor
        alert(response.message);
        // Puedes redirigir a otra página aquí si es necesario
      },
      error: function(xhr, status, error) {
        // Manejar errores si es necesario
        console.error(error);
      }
    });
  });

  // Ingresar solo números CEL
  $('#numeroC').keydown(function(event) {
    // Obtener el código de la tecla presionada
    const key = event.keyCode || event.charCode;

    // Permitir solo números (códigos de teclas 48-57 son números del 0 al 9)
    if (key < 48 || key > 57) {
      // Detener la propagación del evento y prevenir la acción por defecto
      event.preventDefault();
    }
  });

  // Ingresar solo números para el segundo input del segundo formulario
  $('#numeroCelular').keydown(function(event) {
    // Obtener el código de la tecla presionada
    const key = event.keyCode || event.charCode;

    // Permitir solo números (códigos de teclas 48-57 son números del 0 al 9)
    if (key < 48 || key > 57) {
      // Detener la propagación del evento y prevenir la acción por defecto
      event.preventDefault();
    }
  });
});
