    document.addEventListener("DOMContentLoaded", function () {
        let canvas = document.getElementById("firmaCanvas");
        let signaturePad = new SignaturePad(canvas, {
            backgroundColor: "white",
            penColor: "black"
        });

        let canvas2 = document.getElementById("firmaCanvas2");
        let signaturePad2 = new SignaturePad(canvas2, {
            backgroundColor: "white",
            penColor: "black"
        });

        function ajustarCanvas() {
            let ratio = Math.max(window.devicePixelRatio || 1, 1);
            
            // Guardar la firma antes de redimensionar
            let data = signaturePad.toData();
        
            // Establecer tamaño visual (CSS)
            canvas.style.width = canvas.offsetWidth + "px";
            canvas.style.height = canvas.offsetHeight + "px";
        
            // Establecer tamaño real del canvas
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
        
            // Escalar el contexto al ratio correcto
            let context = canvas.getContext("2d");
            context.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
            context.scale(ratio, ratio);
        
            // Volver a asignar el contexto a SignaturePad
            signaturePad = new SignaturePad(canvas, {
                backgroundColor: "white",
                penColor: "black"
            });
        
            // Restaurar la firma si se guardó antes
            if (data) {
                signaturePad.fromData(data);
            }
        }
        
        function ajustarCanvas2() {
            let ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas2.width = canvas2.offsetWidth * ratio;
            canvas2.height = canvas2.offsetHeight * ratio;
            canvas2.getContext("2d").scale(ratio, ratio);
        }
        
        ajustarCanvas();
        ajustarCanvas2();
        
        window.addEventListener("resize", function () {
            ajustarCanvas();
            ajustarCanvas2();
        });
        
        // 📌 Función para limpiar firma    
        window.limpiarFirma = function () {
            signaturePad.clear();
            document.getElementById("firma").value = "";
        
            if (signaturePad2) {
                signaturePad2.clear();
                document.getElementById("firma_bilateral").value = "";
            }
        };
        
        // 📌 Función para limpiar los campos del formulario
        window.limpiarCampos = function () {
            document.getElementById("formulario").reset();
            limpiarFirma();
            limpiarFirmaBilateral();
        };

        const selectBilateral = document.getElementById("bilateral");

        // 📌 Función para guardar datos con AJAX
        window.guardarDatos = async function (event) {
            event.preventDefault(); // Evita envío inmediato del formulario
        
            // ✅ Obtener consentimiento seleccionado
            let consentimientoInput = document.querySelector('input[name="consentimiento"]:checked');
            const consentimiento = consentimientoInput ? consentimientoInput.value.trim().toLowerCase() : null;
            console.log("Consentimiento seleccionado:", consentimiento); 
        
            // Limpia campos de firmas ocultas
            document.getElementById("firma").value = "";
            document.getElementById("firma_bilateral").value = "";
        
            // 🟣 Si el paciente autorizó el uso de la firma
            if (consentimiento === "sí") {
                console.log("✅ El paciente autorizó el uso de la firma para futuros registros."); 
        
                // Firma principal
                if (!signaturePad.isEmpty()) {
                    console.log("🖋 Firma principal detectada. Procediendo a guardar.");
                    document.getElementById("firma").value = signaturePad.toDataURL();
                    await guardarFirma();
                } else {
                    console.log("⚠️ No hay firma principal dibujada.");
                }
        
                // Firma bilateral (si corresponde)
                if (selectBilateral.value === "Si" && !signaturePad2.isEmpty()) {
                    console.log("🖋 Firma bilateral detectada. Procediendo a guardar.");
                    document.getElementById("firma_bilateral").value = signaturePad2.toDataURL();
                    await guardarFirmaBilateral();
                } else if (selectBilateral.value === "Si") {
                    console.log("⚠️ Se seleccionó bilateral, pero no se dibujó la firma.");
                }
        
                // Mostrar mensaje visual
                alert("✅ El paciente autorizó el uso de la firma para futuros registros.");
            } else {
                console.log("🛑 Paciente no autorizó uso de firma: solo datos.");
            }
        
            // 📨 Enviar los datos del formulario
            const formEl  = document.getElementById("formulario");
            const formData = new FormData(formEl);
            try {
                const res  = await fetch(formEl.action, { 
                    method: 'POST', 
                    body: formData 
                });
                const data = await res.json();
                alert(data.mensaje || "✅ Datos guardados correctamente");
                limpiarCampos();
            } catch (err) {
                console.error("❌ Error al guardar datos:", err);
            }
        };        
        
        document.getElementById("formulario").addEventListener("submit", guardarDatos);

        window.verificarCliente = function () {
            let documento = document.getElementById("documento").value;
            console.log("📩 Documento enviado:", documento);

            if (!documento) {
                alert("Por favor ingrese un número de documento.");
                return;
            }

            function cargarFirmaEnCanvas(canvas, firma) {
                let ctx = canvas.getContext("2d");
                let image = new Image();
                image.onload = function () {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(image, 0, 0);
                };
                image.src = firma;
            }

            fetch(`/verificar_cliente?documento=${documento}`)
                .then(response => response.json())
                .then(data => {
                    console.log("✅ Respuesta del servidor:", data);

                    if (data.error) {
                        alert(`Error del servidor: ${data.error}`);
                        return;
                    }

                    if (data.existe === false) {
                        alert("Cliente no encontrado, ingrese los datos manualmente.");
                        return;
                    }

                    // 📌 Llenar el formulario con los datos del cliente
                    const campos = ["tipo_documento", "nombre", "entidad", "servicio", "profesional", "sesiones_aprobadas", 
                                    "sesiones", "lateral", "bilateral", "cancela", "facturador", "sede", "fecha"];

                    campos.forEach(campo => {
                        if (document.getElementById(campo)) {
                            document.getElementById(campo).value = data[campo];
                        }
                    });

                    /// Llamar a cargarFirmaEnCanvas con los datos correctos
                    if (data.firma) {
                        cargarFirmaEnCanvas(canvas, data.firma);
                    }

                    // 🔹 Cargar firma bilateral si existe y activar el canvas2
                    if (data.bilateral === "Si") {
                        let bilateralSelect = document.getElementById("bilateral");
                        bilateralSelect.value = "Si";  // Actualizar el select
                        bilateralSelect.dispatchEvent(new Event("change"));  // 🔥 Forzar el evento change
            
                        if (data.firma_bilateral) {
                            cargarFirmaEnCanvas(document.getElementById("firmaCanvas2"), data.firma_bilateral);
                        }
                    }

                alert("Cliente encontrado y datos cargados.");
            })
            .catch(error => console.error("❌ Error en la verificación:", error));
        }

        window.generarPDF = function () {
            let documento = document.getElementById("documento").value;

            if (!documento) {
                alert("⚠️ Debes ingresar un documento antes de generar el PDF.");
                return;
            }

            window.open(`/generar_pdf?documento=${documento}`, "_blank");
        };

        function guardarFirma() {
            let documento = document.getElementById("documento").value;
            if (!documento) {
                console.error("❌ No hay documento para asociar la firma.");
                return;
            }
        
            // Verificamos el consentimiento antes de proceder
            let consentimientoInput = document.querySelector('input[name="consentimiento"]:checked');
            const consentimiento = consentimientoInput ? consentimientoInput.value : null;
            
            if (consentimiento === "sí") {  // Solo guarda la firma si se autoriza su uso
                let tempCanvas = document.createElement("canvas");
                let tempCtx = tempCanvas.getContext("2d");
        
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
        
                // Fondo Blanco
                tempCtx.fillStyle = "white";
                tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                tempCtx.drawImage(canvas, 0, 0);
        
                let firmaData = tempCanvas.toDataURL("image/png", 1.0);
                console.log("✅ Firma capturada para envío:", firmaData);
        
                fetch("/guardar_firma", {
                    method: "POST",
                    body: JSON.stringify({ 
                        documento: documento, 
                        firma: firmaData, 
                        consentimiento: consentimiento
                    }),
                    headers: { "Content-Type": "application/json" }
                })
                .then(response => response.json())
                .then(data => console.log("Respuesta del servidor:", data))
                .catch(error => console.error("Error al guardar la firma:", error));
            } else {
                console.log("🛑 No se autoriza el uso de la firma.");
            }
        }

        // 📌 Funcionalidad de Lateral y Bilateral
        const lateralSelect = document.getElementById("lateral");

    if (lateralSelect && selectBilateral) {
        lateralSelect.addEventListener("change", () => {
            if (lateralSelect.value === "Si") {
                selectBilateral.value = "No";
            }
        });

        selectBilateral.addEventListener("change", () => {
            if (selectBilateral.value === "Si") {
                lateralSelect.value = "No";
            }
        });
    }

        // 📌 Autocompletado de Profesionales
        const inputProfesional = document.getElementById("profesional");
        const listaProfesionales = document.createElement("ul");

        Object.assign(listaProfesionales.style, {
            position: "absolute",
            background: "white",
            border: "1px solid #ccc",
            listStyle: "none",
            padding: "0",
            margin: "0",
            width: inputProfesional.offsetWidth + "px",
            display: "none",
            maxHeight: "150px",
            overflowY: "auto"
        });

        document.body.appendChild(listaProfesionales);

        inputProfesional.addEventListener("input", function () {
            let termino = inputProfesional.value.trim();
            console.log("🔍 Buscando profesionales con:", termino);

            if (termino.length > 0) {
                fetch(`/buscar_profesional?q=${termino}`)
                    .then(response => response.json())
                    .then(data => {
                        listaProfesionales.innerHTML = "";

                        if (data.length === 0) {
                            listaProfesionales.style.display = "none";
                            return;
                        }

                        listaProfesionales.style.display = "block";
                        listaProfesionales.style.left = inputProfesional.getBoundingClientRect().left + "px";
                        listaProfesionales.style.top = inputProfesional.getBoundingClientRect().bottom + "px";
                        listaProfesionales.style.width = inputProfesional.offsetWidth + "px";

                        data.forEach(profesional => {
                            let item = document.createElement("li");
                            item.textContent = profesional.nombre;
                            item.style.padding = "5px";
                            item.style.cursor = "pointer";

                            item.addEventListener("click", function () {
                                inputProfesional.value = profesional.nombre;
                                listaProfesionales.style.display = "none";
                            });

                            listaProfesionales.appendChild(item);
                        });
                    })
                    .catch(error => console.error("❌ Error al buscar profesionales:", error));
            } else {
                listaProfesionales.style.display = "none";
            }
        });

        document.addEventListener("click", function (event) {
            if (!inputProfesional.contains(event.target) && !listaProfesionales.contains(event.target)) {
                listaProfesionales.style.display = "none";
            }
        });

        // 📌 Autocompletado de Facturador
    const inputFacturador = document.getElementById("facturador");
    const listaFacturadores = document.createElement("ul");

    Object.assign(listaFacturadores.style, {
        position: "absolute",
        background: "white",
        border: "1px solid #ccc",
        listStyle: "none",
        padding: "0",
        margin: "0",
        width: inputFacturador.offsetWidth + "px",
        display: "none",
        maxHeight: "150px",
        overflowY: "auto"
    });

    document.body.appendChild(listaFacturadores);

    inputFacturador.addEventListener("input", function () {
        let termino = inputFacturador.value.trim();
        console.log("🔍 Buscando facturadores con:", termino);

        if (termino.length > 0) {
            fetch(`/buscar_facturador?q=${termino}`)
                .then(response => response.json())
                .then(data => {
                    listaFacturadores.innerHTML = "";

                    if (data.length === 0) {
                        listaFacturadores.style.display = "none";
                        return;
                    }

                    listaFacturadores.style.display = "block";
                    listaFacturadores.style.left = inputFacturador.getBoundingClientRect().left + "px";
                    listaFacturadores.style.top = inputFacturador.getBoundingClientRect().bottom + "px";
                    listaFacturadores.style.width = inputFacturador.offsetWidth + "px";

                    data.forEach(facturador => {
                        let item = document.createElement("li");
                        item.textContent = facturador.nombre;
                        item.style.padding = "5px";
                        item.style.cursor = "pointer";

                        item.addEventListener("click", function () {
                            inputFacturador.value = facturador.nombre;
                            listaFacturadores.style.display = "none";
                        });

                        listaFacturadores.appendChild(item);
                    });
                })
                .catch(error => console.error("❌ Error al buscar facturadores:", error));
        } else {
            listaFacturadores.style.display = "none";
        }
    });

    document.addEventListener("click", function (event) {
        if (!inputFacturador.contains(event.target) && !listaFacturadores.contains(event.target)) {
            listaFacturadores.style.display = "none";
        }
    });

        // Ajustar tamaño inicial y cuando la ventana cambia
        ajustarCanvas2();
        window.addEventListener("resize", ajustarCanvas2);

        function cargarFirmaEnCanvas2() {
            let documento = document.getElementById("documento").value;
            if (!documento) return;
            fetch(`/verificar_cliente?documento=${documento}`)
                .then(response => response.json())
                .then(data => {
                    if (data.firma_bilateral) {
                        let ctx2 = canvas2.getContext("2d");
                        let image2 = new Image();
                        image2.onload = function () {
                            ctx2.clearRect(0, 0, canvas2.width, canvas2.height);
                            ctx2.drawImage(image2, 0, 0);
                        };
                        image2.src = data.firma_bilateral;
                    }
                })
                .catch(error => console.error("❌ Error al cargar la firma bilateral:", error));
        }

        function guardarFirmaBilateral() {
            const documento = document.getElementById("documento").value;
            if (!documento) {
                console.error("❌ No hay documento para asociar la firma bilateral.");
                return;
            }
        
            // Verificamos el consentimiento antes de proceder
            let consentimientoInput = document.querySelector('input[name="consentimiento"]:checked');
            const consentimiento = consentimientoInput ? consentimientoInput.value : null;
            
            if (consentimiento !== "sí") {
                console.log("❌ El paciente no autorizó el uso de su firma bilateral.");
                return;  // No guardamos la firma si no se autoriza
            }
        
            // Si el paciente autorizó la firma bilateral
            const tempCanvas = document.createElement("canvas");
            const tempCtx = tempCanvas.getContext("2d");
        
            tempCanvas.width = canvas2.width;
            tempCanvas.height = canvas2.height;
        
            // Fondo Blanco
            tempCtx.fillStyle = "white";
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.drawImage(canvas2, 0, 0, tempCanvas.width, tempCanvas.height);
        
            const firmaData2 = tempCanvas.toDataURL("image/png");
            console.log("✅ Firma bilateral enviada:", firmaData2);
        
            fetch("/guardar_firma_bilateral", {  
                method: "POST",
                body: JSON.stringify({ 
                    documento: documento,
                    firma: firmaData2,
                    consentimiento: consentimiento
                }),
                headers: { "Content-Type": "application/json" }
            })
            .then(response => response.json())
            .then(data => console.log("✅ Firma bilateral guardada:", data))
            .catch(error => console.error("❌ Error al guardar la firma bilateral:", error));
        }
        
        let bilateralOpcion = document.getElementById("bilateral");
        let firmaCanvas2 = document.getElementById("firmaCanvas2");
        
        bilateralOpcion.addEventListener("change", function () {
            console.log("🌀 Cambio en el campo bilateral:", bilateralOpcion.value);

            if (bilateralOpcion.value === "Si") {
                firmaCanvas2.style.display = "block";
                firmaCanvas2.classList.remove("oculto");
            
                // ⚠️ Esperar un pequeño momento antes de ajustar
                setTimeout(() => {
                    ajustarCanvas2();
                    cargarFirmaEnCanvas2();
                    console.log("🎉 Canvas2 activado y ajustado");
                }, 100);
            } else {
                firmaCanvas2.style.display = "none";
                signaturePad2.clear();
            }
            

        });

        window.buscarHistoria = function () {
            const documento = document.getElementById("documentoBuscar").value;
        
            if (!documento) {
                alert("Por favor ingresa un número de documento");
                return;
            }
        
            fetch(`/historial?documento=${documento}`)
                .then(response => response.json())
                .then(data => {
                    const contenedor = document.getElementById("resultadoHistoria");
                    contenedor.innerHTML = "";
        
                    if (data.length === 0) {
                        contenedor.innerHTML = "<p>No se encontró historial para este documento.</p>";
                        return;
                    }
        
                    let tabla = "<table border='1' cellpadding='6'><tr><th>Fecha</th><th>Servicio</th><th>Profesional</th><th>Sesiones_aprobadas</th><th>Sesiones</th></tr>";
                    data.forEach(item => {
                        tabla += `
                            <tr>
                                <td>${item.fecha}</td>
                                <td>${item.servicio}</td>
                                <td>${item.profesional}</td>
                                <td>${item.sesiones_aprobadas}</td>
                                <td>${item.sesiones}</td>
                            </tr>
                        `;
                    });
                    tabla += "</table>";
                    contenedor.innerHTML = tabla;
                })
                .catch(error => {
                    console.error("Error al buscar historial:", error);
                });
        }
        

        // Detecta cuándo el paciente autoriza o no y limpia/deshabilita canvases
        document.querySelectorAll('input[name="consentimiento"]').forEach(radio => {
        radio.addEventListener('change', () => {
        const isAuth = document.querySelector('input[name="consentimiento"]:checked').value === 'sí';
        // Evita dibujar si no hay autorización
        canvas.style.pointerEvents  = isAuth ? 'auto' : 'none';
        canvas2.style.pointerEvents = isAuth ? 'auto' : 'none';
        if (!isAuth) {
            document.getElementById("firma").value = "";
            document.getElementById("firma_bilateral").value = "";
        }
        });
    });

    })
