describe('Prueba de Regresión: Flujo de Login', () => {
  it('Debe iniciar sesión automáticamente y redirigir al panel', () => {
    // 1. Entrar a la página web local
    cy.visit('http://localhost:5173/login')

    // 2. Escribir el usuario de prueba
    cy.get('input[name="username"]').type('padre')

    // 3. Escribir la contraseña
    cy.get('input[name="password"]').type('padre123')

    // 4. Hacer clic en el botón de Iniciar Sesión
    cy.get('button[type="submit"]').click()

    // 5. Verificar que la URL cambie correctamente después del login
    // Si tu app los manda a "/inicio" o "/servicios", cambialo acá abajo:
    cy.url().should('not.include', '/login') 
  })
})
