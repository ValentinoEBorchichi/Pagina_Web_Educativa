describe('Prueba de Regresión: Flujo de Login', () => {
  it('Debe iniciar sesión automáticamente y redirigir al panel', () => {
    // La prueba valida la interfaz y el enrutamiento sin depender de Azure SQL.
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: {
        token: 'token-de-prueba-cypress',
        user: { id: 1, username: 'padre', nombre: 'Carlos Padre', rol: 'padre' }
      }
    }).as('loginRequest')

    // 1. Entrar a la página web local
    cy.visit('/login?role=padre')

    // 2. Escribir el usuario de prueba
    cy.get('input[name="username"]').type('padre')

    // 3. Escribir la contraseña
    cy.get('input[name="password"]').type('padre123')

    // 4. Hacer clic en el botón de Iniciar Sesión
    cy.get('button[type="submit"]').click()

    cy.wait('@loginRequest').its('request.body').should('deep.include', {
      username: 'padre',
      password: 'padre123'
    })

    // 5. Verificar que la URL cambie correctamente después del login
    cy.url().should('include', '/padre')
  })
})
