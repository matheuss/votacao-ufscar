/**
 * Created by matheus on 5/28/16.
 */

$(function () {
    $('#button').on('click', function () {
        var strike = $('input[name="strike"]:checked').val();
        var locking = $('input[name="locking"]:checked').val();
        var code = $('#code').val();

        if (strike === undefined || locking === undefined) {
            return Materialize.toast('As duas respostas são obrigatórias', 2000);
        }

        if (!code) {
            return Materialize.toast('O Código de Acesso é obrigatório', 2000);
        }

        if (!strike) {
            strike = '---';
        }

        if (!locking) {
            locking = '---';
        }

        var p = $('<p></p>');
        var input = ('input');
        var button = $("a");
        var loading = $('.preloader-wrapper');
        var message = $('.message');

        $(message).empty();
        $(input).prop('disabled', true);
        $(loading).addClass('active');
        $(button).animate({width: 'toggle'});

        var post = $.post('/vote', {strike: strike, locking: locking, code: code});
        post.done(function (vote) {
            var slide = false;
            if (vote.error === 'database') {
                $(p).html('Seu voto não foi computado. Por favor, tente novamente mais tarde');
            } else if (vote.error === 'invalid code') {
                $(p).html('O Código de Acesso digitado não é válido.');
            } else if (vote.error === 'invalid certificate') {
                $(p).html('O Código de Acesso digitado não é de um Atestado de Matrícula.');
            } else if (vote.error === 'unknown') {
                $(p).html('Seu voto não foi computado.<br>Erro: ' + vote.error);
            } else if (vote.student !== undefined) {
                var str = vote.new ? 'Voto computado com sucesso.' : 'Voto atualizado com sucesso.';
                $(p).html(str + '<br>' +
                    '<b>Nome</b>: ' + vote.student.name + '<br>' +
                    '<b>RA</b>: ' + vote.student.RA + '<br>' +
                    '<b>Curso</b>: ' + vote.student.course + '<br>' +
                    '<b>Campus</b>: ' + vote.student.campus + '<br>' +
                    '<b>Greve</b>: ' + vote.strike + '<br>' +
                    '<b>Trancamento</b>: ' + vote.locking);
                slide = true;
            } else {

            }


            if (slide) {
                var action = $('.card-action');
                $(action).slideUp();
                $('.content').slideUp('slow', function () {
                    $(this).html(p);
                    $(button).prop('href', '/results');
                    $(button).text('Resultados');

                    $(button).animate({width: 'toggle'});
                    $(loading).removeClass('active');

                    $(this).slideDown('slow');
                    $(action).slideDown('slow');

                    $(button).unbind('click');
                });

            } else {
                $(input).prop('disabled', false);
                $(button).animate({width: 'toggle'});
                $(loading).removeClass('active');
                $(message).html(p);
            }
        })
    });
});
