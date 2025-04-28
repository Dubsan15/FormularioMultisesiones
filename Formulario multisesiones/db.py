import mysql.connector

def conectar_bd():
    return mysql.connector.connect(
        host="localhost",
        user="root",  # Cambia si tienes otra configuración
        password="",  # Deja vacío si no tienes contraseña en XAMPP
        database="asistencia"
    )
