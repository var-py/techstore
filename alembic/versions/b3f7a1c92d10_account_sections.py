"""account sections: addresses, favorites, reviews, notification settings

Revision ID: b3f7a1c92d10
Revises: 1d4c168705f7
Create Date: 2026-10-04 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3f7a1c92d10'
down_revision: Union[str, Sequence[str], None] = '1d4c168705f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('notify_orders', sa.Boolean(), nullable=False, server_default=sa.sql.true()))
    op.add_column('users', sa.Column('notify_promo', sa.Boolean(), nullable=False, server_default=sa.sql.true()))

    op.create_table('address',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('recipient', sa.String(), nullable=False),
    sa.Column('phone', sa.String(), nullable=False),
    sa.Column('city', sa.String(), nullable=False),
    sa.Column('street', sa.String(), nullable=False),
    sa.Column('house', sa.String(), nullable=False),
    sa.Column('apartment', sa.String(), nullable=True),
    sa.Column('postcode', sa.String(), nullable=True),
    sa.Column('comment', sa.String(), nullable=True),
    sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.sql.true()),
    sa.Column('created_at', sa.String(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_address_user_id'), 'address', ['user_id'], unique=False)

    # Заказ может быть привязан к адресу доставки из личного кабинета.
    op.add_column('order', sa.Column('address_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_order_address_id', 'order', 'address', ['address_id'], ['id'])

    op.create_table('favorite',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('product_id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.String(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['product_id'], ['product.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'product_id', name='uq_favorite_user_product')
    )

    op.create_table('review',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('product_id', sa.Integer(), nullable=False),
    sa.Column('rating', sa.Integer(), nullable=False),
    sa.Column('text', sa.String(), nullable=False),
    sa.Column('created_at', sa.String(), nullable=False),
    sa.Column('updated_at', sa.String(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['product_id'], ['product.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'product_id', name='uq_review_user_product')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('review')
    op.drop_table('favorite')
    op.drop_constraint('fk_order_address_id', 'order', type_='foreignkey')
    op.drop_column('order', 'address_id')
    op.drop_index(op.f('ix_address_user_id'), table_name='address')
    op.drop_table('address')
    op.drop_column('users', 'notify_promo')
    op.drop_column('users', 'notify_orders')
