begin;

alter type public.fulfillment_status add value if not exists 'accepted' after 'confirmed';
alter type public.fulfillment_status add value if not exists 'rejected' after 'delivered';

commit;
