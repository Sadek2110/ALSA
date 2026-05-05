# Cambios necesarios de las llamadas a la API

A la hora de hacer una reserva hay que llamar a tres endpoints:

- https://api.b2b.kikoto.com/v1/routes → Para sacar a todas las rutas que hay disponibles y esta devuelve un body de este tipo:
    
    ```json
    
    {
    "id": 381,
    "departure_port_id": 122,
    "destination_port_id": 23,
    "name": "Agaete - Santa Cruz de Tenerife",
    "updated_at": 1772620577
    }
    ```
    
- [https://api.b2b.kikoto.com/v1/routes/<id_ruta>/shipping-companies](https://api.b2b.kikoto.com/v1/routes/1017/shipping-companies) → Para obtener las navieras que ejecutan la ruta y devuelven algo asi:
    
    ```json
    
    {
    "id": 11,
    "name": "Blue Star Ferries",
    "code": "blue",
    "services": 
    	{
    	"passengers": true,
    	"vehicles": true,
    	"pets": true,
    	"check_in": true 
    	}
    }
    ```
    
- [https://api.b2b.kikoto.com/v1/timetables?shipping-company=<id_naviera>](https://api.b2b.kikoto.com/v1/timetables) → Para obtener las salidas que realizan dicha ruta en esa fecha, este endpoint necesita un body:
    
    ```json
    {
        "departure_port_id": <id_puertoOrigen>(se saca de routes),
        "destination_port_id": <id_puertoDestino>(se saca de routes),
        "date": "2026-07-23"
    }
    ```
    

Estas llamadas son las unicas necesarias para poder hacer la reserva. Asegurate de que funciona y no se rompe ninguna funcionalidad del proyecto en frontend.