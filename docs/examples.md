# Usage examples

The examples build an address book: each customer has several addresses, edited together in one form.

![Database schema of the address book](../images/scenario.jpeg)

## Models

Two Active Record classes map the tables; nothing specific to the extension is needed in them. The rules make the posted
attributes safe, so `load()` and `loadMultiple()` assign them.

```php
namespace app\models;

use yii\db\ActiveRecord;

class Customer extends ActiveRecord
{
    public static function tableName()
    {
        return 'customer';
    }

    public function rules()
    {
        return [
            [['first_name', 'last_name'], 'required'],
            [['first_name', 'last_name'], 'string', 'max' => 255],
        ];
    }

    public function getAddresses()
    {
        return $this->hasMany(Address::class, ['customer_id' => 'id']);
    }
}
```

```php
namespace app\models;

use yii\db\ActiveRecord;

class Address extends ActiveRecord
{
    public static function tableName()
    {
        return 'address';
    }

    public function rules()
    {
        return [
            [['full_name', 'address_line1', 'city', 'state', 'postal_code'], 'required'],
            [['full_name', 'address_line1', 'address_line2', 'city', 'state', 'postal_code'], 'string', 'max' => 255],
        ];
    }
}
```

## Request checks

These actions require one to four addresses, matching the view below. Authorize customer creation through the
application's access rules, and make `findModel()` return only a customer the current user may edit. The relation
`$modelCustomer->addresses` is then the allowed set of existing children. A hidden id is not authorization.

Use this application helper before constructing or loading row models. It rejects missing, empty, excessive, sparse or
permuted lists, malformed rows, ids outside the permitted relation and duplicate ids. This schema uses non-negative
integer ids in canonical decimal form; an omitted id or `''` means a new row, but `0` is a real key. Adapt this policy
for other key schemas or optional lists. Keep `id` and `customer_id` out of the address model's safe attributes, as
above.

```php
namespace app\models;

use yii\web\BadRequestHttpException;

final class AddressSubmission
{
    public const MIN_ROWS = 1;
    public const MAX_ROWS = 4;

    public static function validate(mixed $rows, array $existing = []): array
    {
        if (!is_array($rows) || !array_is_list($rows)
            || count($rows) < self::MIN_ROWS || count($rows) > self::MAX_ROWS
        ) {
            throw new BadRequestHttpException('Submit between one and four consecutively indexed addresses.');
        }

        $allowed = [];

        foreach ($existing as $address) {
            $allowed[(string) $address->id] = true;
        }

        $seen = [];
        $postedIDs = [];

        foreach ($rows as $row) {
            if (!is_array($row)) {
                throw new BadRequestHttpException('Invalid address row.');
            }

            $id = array_key_exists('id', $row) ? $row['id'] : '';
            if ($id === '') {
                continue;
            }

            if ((!is_int($id) && !is_string($id)) || preg_match('/^(?:0|[1-9][0-9]*)$/D', (string) $id) !== 1) {
                throw new BadRequestHttpException('Invalid address id.');
            }

            $id = (string) $id;
            if (!isset($allowed[$id]) || isset($seen[$id])) {
                throw new BadRequestHttpException('Unknown or repeated address id.');
            }

            $seen[$id] = true;
            $postedIDs[] = $id;
        }

        return $postedIDs;
    }
}
```

`array_is_list()` requires indexes in order from zero; do not sort or reindex only one side of the
`createMultiple()`/`loadMultiple()` flow. These checks also run for AJAX validation and before any database writes. Only
an authorized, valid submission may delete stored rows that were intentionally omitted. Missing address groups are
rejected here, not interpreted as "delete all".

## Create action

`Model::createMultiple()` creates one `Address` per posted row; the rows are loaded, validated and saved inside one
transaction, which is rolled back when any save is vetoed.

```php
namespace app\controllers;

use app\models\{Address, AddressSubmission, Customer};
use Throwable;
use Yii;
use yii\helpers\ArrayHelper;
use yii\web\{Controller, Response};
use yii\widgets\ActiveForm;
use Yii2\Extensions\DynamicForm\Models\Model;

class CustomerController extends Controller
{
    public function actionCreate()
    {
        $modelCustomer = new Customer();

        $modelsAddress = [new Address()];

        if ($modelCustomer->load(Yii::$app->request->post())) {
            AddressSubmission::validate(Yii::$app->request->post((new Address())->formName()));

            $modelsAddress = Model::createMultiple(Address::class);

            Model::loadMultiple($modelsAddress, Yii::$app->request->post());

            // ajax validation
            if (Yii::$app->request->isAjax) {
                Yii::$app->response->format = Response::FORMAT_JSON;

                return ArrayHelper::merge(
                    ActiveForm::validateMultiple($modelsAddress),
                    ActiveForm::validate($modelCustomer),
                );
            }

            // validate all models
            $valid = $modelCustomer->validate();
            $valid = Model::validateMultiple($modelsAddress) && $valid;

            if ($valid) {
                $transaction = Yii::$app->db->beginTransaction();

                try {
                    if ($flag = $modelCustomer->save(false)) {
                        foreach ($modelsAddress as $modelAddress) {
                            $modelAddress->customer_id = $modelCustomer->id;

                            if (!($flag = $modelAddress->save(false))) {
                                $transaction->rollBack();

                                break;
                            }
                        }
                    }

                    if ($flag) {
                        $transaction->commit();

                        return $this->redirect(['view', 'id' => $modelCustomer->id]);
                    }

                    if ($transaction->isActive) {
                        $transaction->rollBack();
                    }
                } catch (Throwable $e) {
                    if ($transaction->isActive) {
                        $transaction->rollBack();
                    }

                    throw $e;
                }
            }
        }

        return $this->render('create', [
            'modelCustomer' => $modelCustomer,
            'modelsAddress' => empty($modelsAddress) ? [new Address()] : $modelsAddress,
        ]);
    }
}
```

## Update action

Passing the stored addresses and their primary key to `Model::createMultiple()` reuses the models whose key was posted
and creates the rest; validated keys that are no longer posted are deleted after all models pass validation. Adapt
`findModel()` to the application's authorization policy; the usual Gii lookup below does not enforce ownership itself.

```php
namespace app\controllers;

use app\models\{Address, AddressSubmission, Customer};
use Throwable;
use Yii;
use yii\helpers\ArrayHelper;
use yii\web\{Controller, NotFoundHttpException, Response};
use yii\widgets\ActiveForm;
use Yii2\Extensions\DynamicForm\Models\Model;

class CustomerController extends Controller
{
    protected function findModel($id)
    {
        if (($model = Customer::findOne($id)) !== null) {
            return $model;
        }

        throw new NotFoundHttpException('The requested page does not exist.');
    }

    public function actionUpdate($id)
    {
        $modelCustomer = $this->findModel($id);

        $modelsAddress = $modelCustomer->addresses;

        // primary key of $modelsAddress
        $pkey = 'id';

        if ($modelCustomer->load(Yii::$app->request->post())) {
            $postedIDs = AddressSubmission::validate(
                Yii::$app->request->post((new Address())->formName()),
                $modelsAddress,
            );
            $oldIDs = ArrayHelper::map($modelsAddress, $pkey, $pkey);
            $modelsAddress = Model::createMultiple(Address::class, $modelsAddress, $pkey);

            Model::loadMultiple($modelsAddress, Yii::$app->request->post());

            $deletedIDs = array_diff($oldIDs, $postedIDs);

            // ajax validation
            if (Yii::$app->request->isAjax) {
                Yii::$app->response->format = Response::FORMAT_JSON;

                return ArrayHelper::merge(
                    ActiveForm::validateMultiple($modelsAddress),
                    ActiveForm::validate($modelCustomer),
                );
            }

            // validate all models
            $valid = $modelCustomer->validate();

            $valid = Model::validateMultiple($modelsAddress) && $valid;

            if ($valid) {
                $transaction = Yii::$app->db->beginTransaction();

                try {
                    if ($flag = $modelCustomer->save(false)) {
                        if (!empty($deletedIDs)) {
                            Address::deleteAll([$pkey => $deletedIDs]);
                        }

                        foreach ($modelsAddress as $modelAddress) {
                            $modelAddress->customer_id = $modelCustomer->id;

                            if (!($flag = $modelAddress->save(false))) {
                                $transaction->rollBack();

                                break;
                            }
                        }
                    }

                    if ($flag) {
                        $transaction->commit();

                        return $this->redirect(['view', 'id' => $modelCustomer->id]);
                    }

                    if ($transaction->isActive) {
                        $transaction->rollBack();
                    }
                } catch (Throwable $e) {
                    if ($transaction->isActive) {
                        $transaction->rollBack();
                    }

                    throw $e;
                }
            }
        }

        return $this->render('update', [
            'modelCustomer' => $modelCustomer,
            'modelsAddress' => empty($modelsAddress) ? [new Address()] : $modelsAddress,
        ]);
    }
}
```

## View

The view renders the customer fields and, inside the widget, one panel per address. Each panel carries its own insert
and delete buttons, and stored addresses keep their hidden primary key.

```php
use app\models\AddressSubmission;
use yii\helpers\Html;
use yii\widgets\ActiveForm;
use Yii2\Extensions\DynamicForm\DynamicFormWidget;
?>

<div class="customer-form">
    <?php $form = ActiveForm::begin(['id' => 'dynamic-form']); ?>
    <div class="row">
        <div class="col-sm-6">
            <?= $form->field($modelCustomer, 'first_name')->textInput(['maxlength' => true]) ?>
        </div>
        <div class="col-sm-6">
            <?= $form->field($modelCustomer, 'last_name')->textInput(['maxlength' => true]) ?>
        </div>
    </div>

    <div class="panel panel-default">
        <div class="panel-heading"><h4><i class="glyphicon glyphicon-envelope"></i> Addresses</h4></div>
        <div class="panel-body">
            <?php DynamicFormWidget::begin(
                [
                    'widgetContainer' => 'dynamicform_wrapper', // required: only alphanumeric characters plus "_" [A-Za-z0-9_]
                    'widgetBody' => '.container-items', // required: css class selector
                    'widgetItem' => '.item', // required: css class
                    'limit' => AddressSubmission::MAX_ROWS, // enforced by the request guard too
                    'min' => AddressSubmission::MIN_ROWS,
                    'insertButton' => '.add-item', // css class
                    'deleteButton' => '.remove-item', // css class
                    'model' => $modelsAddress[0],
                    'formId' => 'dynamic-form',
                    'formFields' => [
                        'full_name',
                        'address_line1',
                        'address_line2',
                        'city',
                        'state',
                        'postal_code',
                    ],
                ],
            ); ?>

            <div class="container-items"><!-- widgetBody -->
            <?php foreach ($modelsAddress as $i => $modelAddress): ?>
                <div class="item panel panel-default"><!-- widgetItem -->
                    <div class="panel-heading">
                        <h3 class="panel-title pull-left">Address</h3>
                        <div class="pull-right">
                            <button type="button" class="add-item btn btn-success btn-xs"><i class="glyphicon glyphicon-plus"></i></button>
                            <button type="button" class="remove-item btn btn-danger btn-xs"><i class="glyphicon glyphicon-minus"></i></button>
                        </div>
                        <div class="clearfix"></div>
                    </div>
                    <div class="panel-body">
                        <?php
                            // necessary for update action.
                            if (!$modelAddress->isNewRecord) {
                                echo Html::activeHiddenInput($modelAddress, "[{$i}]id");
                            }
                        ?>
                        <?= $form->field($modelAddress, "[{$i}]full_name")->textInput(['maxlength' => true]) ?>
                        <div class="row">
                            <div class="col-sm-6">
                                <?= $form->field($modelAddress, "[{$i}]address_line1")->textInput(['maxlength' => true]) ?>
                            </div>
                            <div class="col-sm-6">
                                <?= $form->field($modelAddress, "[{$i}]address_line2")->textInput(['maxlength' => true]) ?>
                            </div>
                        </div><!-- .row -->
                        <div class="row">
                            <div class="col-sm-4">
                                <?= $form->field($modelAddress, "[{$i}]city")->textInput(['maxlength' => true]) ?>
                            </div>
                            <div class="col-sm-4">
                                <?= $form->field($modelAddress, "[{$i}]state")->textInput(['maxlength' => true]) ?>
                            </div>
                            <div class="col-sm-4">
                                <?= $form->field($modelAddress, "[{$i}]postal_code")->textInput(['maxlength' => true]) ?>
                            </div>
                        </div><!-- .row -->
                    </div>
                </div>
            <?php endforeach; ?>
            </div>
            <?php DynamicFormWidget::end(); ?>
        </div>
    </div>

    <div class="form-group">
        <?= Html::submitButton($modelCustomer->isNewRecord ? 'Create' : 'Update', ['class' => 'btn btn-primary']) ?>
    </div>

    <?php ActiveForm::end(); ?>
</div>
```

Listen to the widget events described in the [configuration guide](configuration.md#javascript-events) to confirm
deletions or react to inserted rows.

[Back to documentation](../README.md#documentation)
