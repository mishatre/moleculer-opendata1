"use strict";

import moleculer from "moleculer";
import { Event, Service } from "moleculer-decorators";
import { TelegramService } from '@d0whc3r/moleculer-telegram';

@Service({

    name: "telegram",
    mixins: [TelegramService],
    // dependencies: ['events'],

    /**
	 * Service settings
	 */
    settings: {
        $secureSettings: ["telegramToken", "telegramChannel"],
        telegramToken: "1947418987:AAGhbq8RCBq2E1A0SUQKyMWs_W8zMywuudw",
        telegramChannel: '-539754824',
    },

})
class TgService extends moleculer.Service {

    @Event({
        name: 'ticket.assigned',
    })
    public async onAssignedTicket(ticket: any) {

        console.log('Where')

        const userId = ticket.executor;
        const client = ticket.client;
        const device = ticket.device?.classificator?.title || 'unknown device';
        const reason = ticket.reason;

        try {
            this.broker.call('telegram.send', { 
                message: `Запланирован выезд!
    С 16.09.2021 по 17.09.2021
    Клиент: ${client}
    Оборудование: ${device}
    Цель: ${reason}
    Исполнитель: ${userId}`, 
                token: this.settings.telegramToken, 
                channel: this.settings.telegramChannel 
            })
        } catch(error) {
            console.log(error);
        }
    }

    @Event({
        name: 'tickets.completed',
    })
    public async onCompletedTicket(ticket: any) {

        const userId = ticket.executor;
        const client = ticket.client;
        const device = ticket.device?.classificator?.title || 'unknown device';
        const reason = ticket.reason;

        try {
            this.broker.call('telegram.send', { 
                message: `Выполнен выезд
    С 16.09.2021 по 17.09.2021
    Клиент: ${client}
    Оборудование: ${device}
    Цель: ${reason}
    Исполнитель: ${userId}`, 
                token: this.settings.telegramToken, 
                channel: this.settings.telegramChannel 
            })
        } catch(error) {
            console.log(error);
        }
    }

    @Event({
        name: 'tickets.cancelled',
    })
    public async onCancelledTicket(ticket: any) {

        const userId = ticket.executor;
        const client = ticket.client;
        const device = ticket.device?.classificator?.title || 'unknown device';
        const reason = ticket.reason;

        try {
            this.broker.call('telegram.send', { 
                message: `Выезд отменен
    С 16.09.2021 по 17.09.2021
    Клиент: ${client}
    Оборудование: ${device}
    Цель: ${reason}
    Исполнитель: ${userId}`, 
                token: this.settings.telegramToken, 
                channel: this.settings.telegramChannel 
            })
        } catch(error) {
            console.log(error);
        }
    }
    
}

export = TgService;
