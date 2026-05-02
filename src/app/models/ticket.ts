import { Customer } from "./customer";
import { Service } from "./service";

export interface Ticket {

    _id: string,
    created_at: Date,
    cliente_id: string,
    estado_id: string[],
    contador: number,
    comentarios: string[],
    fecha_vencimiento: Date,
    cliente: Customer,
    estado: any,
    servicios: Service[]
}