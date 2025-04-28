from flask import Flask, request, jsonify, render_template, send_file
from db import conectar_bd
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
import mysql.connector
import base64
import os 

app = Flask(__name__)

# Configurar conexión con MySQL
def obtener_conexion():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="asistencia"
    )

# Ruta donde se guardarán las firmas bilaterales
FIRMA_BILATERAL_FOLDER = os.path.join(os.getcwd(), "static/FirmaBilateral/")


# Crear la carpeta si no existe
if not os.path.exists(FIRMA_BILATERAL_FOLDER):
    os.makedirs(FIRMA_BILATERAL_FOLDER)


FUENTE_PATH = os.path.abspath(os.path.join("static", "fonts", "GOTHIC.TTF"))
pdfmetrics.registerFont(TTFont("CenturyGothic", FUENTE_PATH))


# Carpeta para guardar firmas 
UPLOAD_FOLDER = "static/firmas/"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Verificar conexión a la base de datos al iniciar el servidor
conexion = conectar_bd()
if conexion.is_connected():
    print("\u2705 Conexión exitosa a la base de datos")
    conexion.close()
else:
    print("\u274c Error al conectar a la base de datos")

# Ruta para mostrar el formulario
@app.route('/')
def index():
    return render_template('formulario.html')

@app.route('/guardar', methods=['POST'])
def guardar_datos():
    try:
        conexion = conectar_bd()
        cursor = conexion.cursor()

        # Obtener datos del formulario
        tipo_documento = request.form.get('tipo_documento')
        documento = request.form.get('documento')
        nombre = request.form.get('nombre')
        entidad = request.form.get('entidad')
        servicio = request.form.get('servicio')
        profesional = request.form.get('profesional')
        sesiones_aprobadas = int(request.form["sesiones_aprobadas"])  # Asegurar que es un número
        sesiones = request.form.get('sesiones')
        lateral = request.form.get('lateral')
        bilateral = request.form.get('bilateral')
        cancela = request.form.get('cancela')
        facturador = request.form.get('facturador')
        fecha = request.form.get('fecha')
        sede = request.form.get('sede')                                                             

        if not documento or not nombre:
            return jsonify({"error": "Faltan datos obligatorios"}), 400

        # Insertar en la base de datos
        sql = """INSERT INTO clientes (tipo_documento, documento, nombre, entidad, servicio, profesional, sesiones_aprobadas, sesiones, lateral, bilateral, cancela, facturador, fecha, sede) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"""
        valores = (tipo_documento, documento, nombre, entidad, servicio, profesional, sesiones_aprobadas, sesiones, lateral, bilateral, cancela, facturador, fecha, sede)

        cursor.execute(sql, valores)
        conexion.commit()

        return jsonify({"mensaje": "\u2705 Datos guardados correctamente"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        conexion.close()


@app.route('/guardar_firma', methods=['POST'])
def guardar_firma():
    try:
        data = request.get_json()
        documento = data.get('documento')
        firma_base64 = data.get('firma')

        if not documento or not firma_base64:
            return jsonify({"error": "Faltan datos para guardar la firma"}), 400

        firma_data = firma_base64.split(",")[1]
        firma_bytes = base64.b64decode(firma_data)

        firma_path = os.path.join(UPLOAD_FOLDER, f"{documento}.png")
        with open(firma_path, "wb") as f:
            f.write(firma_bytes)

        return jsonify({"mensaje": "✅ Firma guardada correctamente"}), 200

    except Exception as e:
        return jsonify({"error": f"Ocurrió un error al guardar la firma: {str(e)}"}), 500


@app.route('/verificar_cliente', methods=['GET'])
def verificar_cliente():
    try:
        documento = request.args.get('documento')
        if not documento:
            return jsonify({"error": "No se recibió documento"}), 400

        conexion = obtener_conexion()
        cursor = conexion.cursor(dictionary=True)

        # 🔹 Buscar el cliente con el documento, obteniendo el último registro
        cursor.execute("SELECT * FROM clientes WHERE documento = %s ORDER BY fecha DESC LIMIT 1", (documento,))
        cliente = cursor.fetchone()

        cursor.close()
        conexion.close()

        if cliente is None:
            return jsonify({"existe": False})

        # ✅ Convertir fechas a string para evitar errores con JSON
        cliente["fecha"] = str(cliente["fecha"]) if cliente["fecha"] else ""

        # 🔹 Verificar si la firma principal existe
        firma_path = os.path.join("static", "firmas", f"{documento}.png")
        cliente["firma"] = f"/{firma_path}" if os.path.exists(firma_path) else None

        # 🔹 Verificar si la firma bilateral existe
        firma_bilateral_path = os.path.join("static", "FirmaBilateral", f"{documento}_bilateral.png")
        cliente["firma_bilateral"] = f"/{firma_bilateral_path}" if os.path.exists(firma_bilateral_path) else None
        print(f"🔍 Buscando firma bilateral en: {firma_bilateral_path}")  # 🔥 Debug
        print(f"🟢 Existe?: {os.path.exists(firma_bilateral_path)}")  # 🔥 Debug

        return jsonify(cliente)

    except Exception as e:
        return jsonify({"error": f"Ocurrió un error: {str(e)}"}), 500

from reportlab.lib.utils import ImageReader

@app.route('/generar_pdf', methods=['GET'])
def generar_pdf():
    try:
        documento = request.args.get('documento')
        if not documento:
            return jsonify({"error": "Documento no proporcionado"}), 400

        conexion = obtener_conexion()
        cursor = conexion.cursor(dictionary=True)
        cursor.execute("SELECT * FROM clientes WHERE documento = %s ORDER BY fecha DESC LIMIT 1", (documento,))
        cliente = cursor.fetchone()
        cursor.close()
        conexion.close()

        if not cliente:
            return jsonify({"error": "Cliente no encontrado"}), 404

        # 👉 Formatear fecha
        fecha_str = ""
        if cliente["fecha"]:
            try:
                fecha_str = cliente["fecha"].strftime("%d/%m/%Y")
            except AttributeError:
                try:
                    fecha_obj = datetime.strptime(str(["fecha"]), "%Y-%m-%d")
                    fecha_str = fecha_obj.strftime("%d/%m/%Y")
                except ValueError:
                    fecha_str = str(cliente["fecha"])

        ruta_pdf = f"static/reportes/reporte_{documento}.pdf"
        c = canvas.Canvas(ruta_pdf, pagesize=letter)

        # 🖼️ Logo y texto encabezado
        logo_path = "static/Imagenes/logo.jpeg"
        if os.path.exists(logo_path):
            c.drawImage(logo_path, 45, 705, width=80, height=80, preserveAspectRatio=True)
        c.setFont("Helvetica-Bold", 26)
        c.drawString(210, 740, "ELECTROFISIATRIA")
        c.line(30, 705, 570, 705)

        # 📌 Datos del cliente
        c.setFont("CenturyGothic", 12)
        y = 660
        espacio = 25
        datos_cliente = [
            ("Documento:", cliente["documento"]),
            ("Nombre:", cliente["nombre"]),
            ("Entidad:", cliente["entidad"]),
            ("Servicio:", cliente["servicio"]),
            ("Profesional:", cliente["profesional"]),
            ("Sesiones Aprobadas:", cliente["sesiones_aprobadas"]),
            ("Sesiones:", cliente["sesiones"]),
            ("Lateral:", cliente["lateral"]),
            ("Bilateral:", cliente["bilateral"]),
            ("Cancela:", cliente["cancela"]),
            ("Facturador:", cliente["facturador"]),
            ("Fecha de Registro:", fecha_str),
            ("Sede:", cliente["sede"])
        ]
        for etiqueta, valor in datos_cliente:
            c.drawString(100, y, f"{etiqueta} {valor}")
            y -= espacio

        # 📌 Firmas
        firma_path = f"static/firmas/{documento}.png"
        if os.path.exists(firma_path):
            c.drawString(100, y - 30, "Firma del Cliente:")
            firma = ImageReader(firma_path)
            c.drawImage(firma, 100, y - 100, width=200, height=80)
            y -= 120

        firma_bilateral_path = f"static/FirmaBilateral/{documento}_bilateral.png"
        if os.path.exists(firma_bilateral_path):
            c.drawString(100, y - 30, "Firma Bilateral:")
            firma_bilateral = ImageReader(firma_bilateral_path)
            c.drawImage(firma_bilateral, 100, y - 100, width=200, height=80)
            y -= 120

        c.line(50, 70, 550, 70)
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(300, 50, "ELECTROFISIATRIA SAS - CALLE 112 #70b-28  -  PBX (601) 665 29 99 ")
        c.save()

        return send_file(ruta_pdf, as_attachment=True)

    except Exception as e:
        return jsonify({"error": f"Error al generar PDF: {str(e)}"}), 500



@app.route('/buscar_profesional', methods=['GET'])
def buscar_profesional():
    try:
        query = request.args.get("q", "").strip()
        
        if not query:
            return jsonify([])  # Si no hay query, devolver lista vacía
        
        conexion = obtener_conexion()
        cursor = conexion.cursor(dictionary=True)

        print(f"🔍 Buscando profesionales con: {query}")  # 🔥 Para ver qué llega

        cursor.execute("SELECT DISTINCT nombre FROM profesionales WHERE nombre LIKE %s", (f"%{query}%",))
        profesionales = cursor.fetchall()

        print(f"📋 Resultados encontrados: {profesionales}")  # 🔥 Para verificar la consulta

        cursor.close()
        conexion.close()

        return jsonify(profesionales)
    except Exception as e:
        print(f"❌ Error en la búsqueda: {str(e)}")  # 🔥 Para ver errores
        return jsonify({"error": f"Error al buscar profesionales: {str(e)}"}), 500


@app.route('/buscar_facturador')
def buscar_facturador():
    termino = request.args.get('q', '').strip()
    
    if not termino:
        return jsonify([])

    conexion = obtener_conexion()
    cursor = conexion.cursor(dictionary=True)
    
    consulta = "SELECT nombre FROM facturadores WHERE nombre LIKE %s LIMIT 10"
    cursor.execute(consulta, (f"%{termino}%",))
    
    resultados = cursor.fetchall()
    
    cursor.close()
    conexion.close()
    
    return jsonify(resultados)


@app.route('/guardar_firma_bilateral', methods=['POST'])
def guardar_firma_bilateral():
    data = request.get_json()
    documento = data.get('documento')
    firma_base64 = data.get('firma')
    consentimiento = data.get('consentimiento')  # ✅ nuevo campo

    if consentimiento != "sí":
        return jsonify({"mensaje": "El usuario no autorizó el uso de la firma bilateral"}), 200

    if not documento or not firma_base64:
        return jsonify({"error": "Faltan datos"}), 400

    firma_data = firma_base64.split(",")[1]
    firma_bytes = base64.b64decode(firma_data)

    filename = f"{documento}_bilateral.png"
    filepath = os.path.join(FIRMA_BILATERAL_FOLDER, filename)

    with open(filepath, "wb") as f:
        f.write(firma_bytes)

    return jsonify({"mensaje": "Firma bilateral guardada", "ruta": filepath})

@app.route('/historial')
def historial():
    documento = request.args.get('documento')

    if not documento:
        return jsonify([])

    try:
        conn = obtener_conexion()  # Usamos tu función correcta
        cursor = conn.cursor(dictionary=True)

        # 🔄 Ahora consultamos la tabla clientes
        query = """
        SELECT fecha, servicio, profesional, sesiones_aprobadas,sesiones
        FROM clientes
        WHERE documento = %s
        ORDER BY fecha DESC
        """
        cursor.execute(query, (documento,))
        historial = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify(historial)

    except Exception as e:
        print("❌ Error en /historial:", e)
        return jsonify({"error": "Error interno en el servidor"}), 500



if __name__ == '__main__':
    app.run(debug=True)
